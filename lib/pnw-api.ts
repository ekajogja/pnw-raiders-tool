interface ApiResponse {
  data: any
}

interface Nation {
  id: number
  nation_name: string
  score: number
  soldiers: number
  tanks: number
  aircraft: number
  ships: number
  missiles: number
  nukes: number
  spies: number
  alliance?: {
    id: number
    name: string
    treaties?: Treaty[]
  }
  alliance_id?: number
  vacation_mode_turns?: number
  beige_turns?: number
  color?: string
  gross_national_income?: number
  cities?: City[]
  wars?: War[]
  defensive_wars_count?: number
}

interface City {
  supermarket: number
  bank: number
  shopping_mall: number
  stadium: number
  subway: number
  infrastructure?: number
}

interface War {
  turns_left: number
  date: string
  def_id: number
  attacks?: Attack[]
}

interface Attack {
  def_id: number
  money_stolen: number
  date: string
}

interface Treaty {
  alliance1_id: number
  alliance2_id: number
  treaty_type: string
  treaty_url?: string
}

const RATE_LIMIT_DELAY = 100 // 100ms delay between requests

export async function runQuery(apiKey: string, query: string): Promise<ApiResponse> {
  console.log("Running GraphQL query", { queryLength: query.length })
  
  if (!apiKey) {
    throw new Error("API_KEY is not provided. Please enter your Politics & War API key.")
  }

  const API_URL = `https://api.politicsandwar.com/graphql?api_key=${apiKey}`

  try {
    // Add delay between requests
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    
    console.log("Making request to PnW API")
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })

    console.log("API response received", { status: response.status })

    // Handle specific HTTP error codes
    if (response.status === 401) {
      throw new Error("API authentication failed. Check your API key.")
    } else if (response.status === 403) {
      throw new Error("API access forbidden. Your key may be invalid or lacks permissions.")
    } else if (response.status === 429) {
      console.log("Rate limit hit, waiting to retry...")
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      const retryResponse = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      
      if (retryResponse.status !== 200) {
        throw new Error(`Rate limit retry failed with status code ${retryResponse.status}`)
      }
      
      const retryData = await retryResponse.json()
      return retryData
    } else if (response.status !== 200) {
      throw new Error(`API request failed with status code ${response.status}`)
    }

    // Parse response as JSON
    const data = await response.json()
    console.log("API data parsed", { hasData: !!data.data, hasErrors: !!data.errors })

    // Check for GraphQL errors
    if (data.errors) {
      const errorMessages = data.errors.map((error: any) => error.message || "Unknown GraphQL error")
      const errorMessage = errorMessages.join("; ")
      console.error("GraphQL API Error:", errorMessage)
      throw new Error(`GraphQL API Error: ${errorMessage}`)
    }

    // Validate response structure
    if (!data.data) {
      throw new Error("API response missing 'data' field")
    }

    return data

  } catch (error) {
    console.error("API query error:", error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`API query failed: ${error}`)
  }
}

export async function getNationById(apiKey: string, nationId: number): Promise<Nation> {
  console.log("Getting nation by ID", { nationId })
  
  const query = `
    query {
      nations(id: ${nationId}, first: 1) {
        data {
          id
          nation_name
          score
          soldiers
          tanks
          aircraft
          ships
          missiles
          nukes
          spies
          color
          vacation_mode_turns
          alliance_id
          gross_national_income
          cities {
            supermarket
            bank
            shopping_mall
            stadium
            subway
          }
          wars {
            turns_left
            date
            def_id
            attacks {
              def_id
              money_stolen
              date
            }
          }
          defensive_wars_count
          beige_turns
          alliance {
            id
            name
            treaties {
              alliance1_id
              alliance2_id
              treaty_type
              treaty_url
            }
          }
        }
      }
    }
  `
  
  const data = await runQuery(apiKey, query)
  
  // Validate response structure
  if (!data.data?.nations?.data || !Array.isArray(data.data.nations.data)) {
    throw new Error("API response missing 'nations.data' field or it's not a list.")
  }

  if (data.data.nations.data.length === 0) {
    throw new Error(`Nation with ID ${nationId} not found.`)
  }

  console.log("Nation data retrieved", { nationName: data.data.nations.data[0].nation_name })
  return data.data.nations.data[0]
}

export async function getNations(apiKey: string, page: number = 1): Promise<any> {
  console.log("Getting nations page", { page })
  
  const query = `
    {
      nations(page: ${page}, first: 500) {
        data {
          id
          nation_name
          score
          alliance_id
          vacation_mode_turns
          beige_turns
          color
          soldiers
          tanks
          aircraft
          ships
          missiles
          nukes
          spies
          gross_national_income
          cities {
            supermarket
            bank
            shopping_mall
            stadium
            subway
          }
          alliance {
            id
            name
            treaties {
              alliance1_id
              alliance2_id
              treaty_type
            }
          }
          wars {
            turns_left
            date
            def_id
            attacks {
              def_id
              money_stolen
              date
            }
          }
          defensive_wars_count
        }
        paginatorInfo {
          hasMorePages
          currentPage
        }
      }
    }
  `
  
  const data = await runQuery(apiKey, query)
  
  // Additional validation for this specific endpoint
  if (!data.data?.nations) {
    throw new Error("API response missing 'nations' field - API format may have changed")
  }
  
  if (!data.data.nations.data) {
    throw new Error("API response missing nation data")
  }

  const nationCount = data.data.nations.data.length
  console.log(`Successfully fetched ${nationCount} nations from API (page ${page})`)

  return data.data.nations
}

export function hasTreaty(myAlliance: any, targetAlliance: any, protectedTypes?: string[]): boolean {
  const defaultProtectedTypes = ['MDP', 'MDOAP', 'ODP', 'ODOAP', 'NAP', 'PIAT', 'Protectorate']
  const treatyTypes = protectedTypes || defaultProtectedTypes

  if (!myAlliance || !targetAlliance) {
    return false
  }

  // Check both alliances' treaties
  const treaties = myAlliance.treaties || []
  for (const treaty of treaties) {
    if ((treaty.alliance1_id === targetAlliance.id || treaty.alliance2_id === targetAlliance.id)) {
      if (treatyTypes.includes(treaty.treaty_type)) {
        return true
      }
    }
  }

  return false
}