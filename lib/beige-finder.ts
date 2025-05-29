import { getNationById, getNations, hasTreaty } from './pnw-api'

interface BeigeConfig {
  MIN_SCORE_RATIO: number
  MAX_SCORE_RATIO: number
  MAX_PAGES: number
}

const config: BeigeConfig = {
  MIN_SCORE_RATIO: 0.75,
  MAX_SCORE_RATIO: 1.5,
  MAX_PAGES: 10
}

export interface BeigeTarget {
  id: number
  name: string
  score: number
  beige_turns: number
  alliance: string
  money_stolen_recent_def_war: number
  seven_days_stolen: number
  most_recent_def_war_date: string
  last_stolen_time_ago_str: string
  gni: number
  daily_income: number
  nation_url: string
  city_count: number | string
  soldiers: number
  tanks: number
  aircraft: number
  ships: number
  missiles: number
  nukes: number
  spies: number
  infrastructure: number
  supermarket: number
  bank: number
  shopping_mall: number
  stadium: number
  subway: number
  defensive_wars_count: number
}

export async function findBeigeTargets(
  apiKey: string, 
  nationId: number, 
  limit: number = 10, 
  maxPages: number = config.MAX_PAGES
): Promise<{ myNation: any; targets: BeigeTarget[] }> {
  console.log("Starting beige target search", { nationId, limit, maxPages })
  
  // Get my nation's info first
  const myNation = await getNationById(apiKey, nationId)
  console.log("Retrieved user nation", { name: myNation.nation_name, score: myNation.score })
  
  const minScore = myNation.score * config.MIN_SCORE_RATIO
  const maxScore = myNation.score * config.MAX_SCORE_RATIO
  
  console.log("Score range calculated", { minScore, maxScore })
  
  let page = 1
  const filtered: BeigeTarget[] = []
  
  while (page <= maxPages && filtered.length < limit) {
    console.log(`Fetching page ${page}`)
    
    try {
      const nationsData = await getNations(apiKey, page)
      
      if (!nationsData.data || nationsData.data.length === 0) {
        console.log("No more nations to fetch")
        break
      }
      
      console.log(`Processing ${nationsData.data.length} nations from page ${page}`)
      
      // Process nations and filter
      for (const nation of nationsData.data) {
        if (filtered.length >= limit) {
          console.log("Reached target limit, stopping")
          break
        }
        
        // Apply filters
        if (!isValidBeigeTarget(nation, myNation, minScore, maxScore)) {
          continue
        }
        
        // Calculate stolen money metrics
        const { sevenDaysStolen, lastStolenInfo } = calculateStolenMoney(nation)
        
        // Skip nations with zero 7-day stolen money
        if (sevenDaysStolen === 0) {
          continue
        }
        
        // Skip nations with 3+ defensive wars
        if (nation.defensive_wars_count >= 3) {
          continue
        }
        
        // Calculate infrastructure and commerce buildings
        const infrastructureData = calculateInfrastructure(nation)
        const commerceData = calculateCommerceBuildings(nation)
        
        const target: BeigeTarget = {
          id: nation.id,
          name: nation.nation_name,
          score: nation.score,
          beige_turns: nation.beige_turns || 0,
          alliance: nation.alliance?.name || 'No Alliance',
          money_stolen_recent_def_war: lastStolenInfo.amount,
          seven_days_stolen: sevenDaysStolen,
          most_recent_def_war_date: lastStolenInfo.date,
          last_stolen_time_ago_str: lastStolenInfo.timeAgo,
          gni: nation.gross_national_income || 0,
          daily_income: (nation.gross_national_income || 0) / 365.0,
          nation_url: `https://politicsandwar.com/nation/id=${nation.id}`,
          city_count: nation.cities?.length || '?',
          soldiers: nation.soldiers || 0,
          tanks: nation.tanks || 0,
          aircraft: nation.aircraft || 0,
          ships: nation.ships || 0,
          missiles: nation.missiles || 0,
          nukes: nation.nukes || 0,
          spies: nation.spies || 0,
          infrastructure: infrastructureData,
          ...commerceData,
          defensive_wars_count: nation.defensive_wars_count || 0
        }
        
        filtered.push(target)
        console.log(`Added beige target: ${target.name} (${filtered.length}/${limit})`)
      }
      
      // Check if we should continue to next page
      if (!nationsData.paginatorInfo?.hasMorePages) {
        console.log("No more pages available")
        break
      }
      
      page++
      
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error)
      
      if (filtered.length > 0) {
        console.log(`Using ${filtered.length} targets already found before error`)
        break
      } else {
        throw new Error("Could not fetch any nation data from API")
      }
    }
  }
  
  // Sort targets by beige_turns (ascending) then by 7-day stolen money (descending)
  filtered.sort((a, b) => {
    if (a.beige_turns !== b.beige_turns) {
      return a.beige_turns - b.beige_turns
    }
    return b.seven_days_stolen - a.seven_days_stolen
  })
  
  console.log(`Beige target search completed. Found ${filtered.length} targets`)
  
  return { myNation, targets: filtered }
}

function isValidBeigeTarget(nation: any, myNation: any, minScore: number, maxScore: number): boolean {
  // Score range check
  if (!(minScore <= nation.score && nation.score <= maxScore)) {
    return false
  }
  
  // Vacation mode check
  if (nation.vacation_mode_turns > 0) {
    return false
  }
  
  // Beige check (beige targets should be beige with 1-12 turns remaining)
  if (nation.color?.toLowerCase() !== 'beige') {
    return false
  }
  
  if (nation.beige_turns < 1 || nation.beige_turns > 12) {
    return false
  }
  
  // Treaty check
  if (nation.alliance_id && myNation.alliance && nation.alliance) {
    if (hasTreaty(myNation.alliance, nation.alliance)) {
      return false
    }
  }
  
  // Military strength check
  if (nation.ships > myNation.ships ||
      nation.missiles > myNation.missiles ||
      nation.nukes > myNation.nukes ||
      nation.spies > myNation.spies) {
    return false
  }
  
  return true
}

function calculateStolenMoney(nation: any): {
  sevenDaysStolen: number
  lastStolenInfo: { amount: number; date: string; timeAgo: string }
} {
  let sevenDaysStolen = 0
  let totalMoneyFromRecentWar = 0
  let mostRecentWarDate = 'N/A'
  let lastStolenTimeAgo = 'N/A'
  
  if (nation.wars && Array.isArray(nation.wars)) {
    const defensiveWars = nation.wars.filter((war: any) => war.def_id === nation.id)
    
    if (defensiveWars.length > 0) {
      // Find most recent defensive war
      const mostRecentWar = defensiveWars.sort((a: any, b: any) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
      
      mostRecentWarDate = new Date(mostRecentWar.date).toISOString()
      
      // Calculate time ago
      const warDate = new Date(mostRecentWar.date)
      const now = new Date()
      const hoursAgo = Math.floor((now.getTime() - warDate.getTime()) / (1000 * 60 * 60))
      const days = Math.floor(hoursAgo / 24)
      const hours = hoursAgo % 24
      
      if (days > 0) {
        lastStolenTimeAgo = `${days}d ${hours}h ago`
      } else {
        lastStolenTimeAgo = `${hoursAgo}h ago`
      }
      
      // Calculate stolen money from most recent war
      if (mostRecentWar.attacks) {
        for (const attack of mostRecentWar.attacks) {
          if (attack.def_id === nation.id) {
            totalMoneyFromRecentWar += attack.money_stolen || 0
          }
        }
      }
    }
    
    // Calculate stolen money over 7 days
    for (const war of nation.wars) {
      if (war.def_id === nation.id) {
        const warDate = new Date(war.date)
        const now = new Date()
        const daysDiff = (now.getTime() - warDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= 7 && war.attacks) {
          for (const attack of war.attacks) {
            if (attack.def_id === nation.id) {
              sevenDaysStolen += attack.money_stolen || 0
            }
          }
        }
      }
    }
  }
  
  return {
    sevenDaysStolen,
    lastStolenInfo: {
      amount: totalMoneyFromRecentWar,
      date: mostRecentWarDate,
      timeAgo: lastStolenTimeAgo
    }
  }
}

function calculateInfrastructure(nation: any): number {
  let totalInfrastructure = 0
  
  if (nation.cities && Array.isArray(nation.cities)) {
    for (const city of nation.cities) {
      totalInfrastructure += city.infrastructure || 0
    }
  }
  
  return totalInfrastructure
}

function calculateCommerceBuildings(nation: any): {
  supermarket: number
  bank: number
  shopping_mall: number
  stadium: number
  subway: number
} {
  let supermarket = 0
  let bank = 0
  let shopping_mall = 0
  let stadium = 0
  let subway = 0
  
  if (nation.cities && Array.isArray(nation.cities)) {
    for (const city of nation.cities) {
      supermarket += city.supermarket || 0
      bank += city.bank || 0
      shopping_mall += city.shopping_mall || 0
      stadium += city.stadium || 0
      subway += city.subway || 0
    }
  }
  
  return {
    supermarket,
    bank,
    shopping_mall,
    stadium,
    subway
  }
}