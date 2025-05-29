'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, Sword, Shield, DollarSign, Users, Clock, TrendingUp } from 'lucide-react'

interface Target {
  id: number
  name: string
  score: number
  alliance: string
  money_stolen_recent_def_war: number
  seven_days_stolen: number
  one_day_stolen?: number
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
  supermarket: number
  bank: number
  shopping_mall: number
  stadium: number
  subway: number
  defensive_wars_count: number
  beige_turns?: number
  infrastructure?: number
}

interface SearchResults {
  targets?: Target[]
  searchTitle?: string
  error?: string
}

export default function ResultsPage() {
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  console.log("ResultsPage rendered", { results, isLoading })

  useEffect(() => {
    console.log("ResultsPage useEffect triggered")
    
    // Get results from sessionStorage
    const storedResults = sessionStorage.getItem('searchResults')
    
    if (storedResults) {
      console.log("Found stored results in sessionStorage")
      try {
        const parsedResults = JSON.parse(storedResults)
        console.log("Parsed results", { 
          hasTargets: !!parsedResults.targets, 
          targetsCount: parsedResults.targets?.length,
          hasError: !!parsedResults.error 
        })
        setResults(parsedResults)
      } catch (error) {
        console.error("Error parsing stored results:", error)
        setResults({
          error: "Error loading search results",
          searchTitle: "Error"
        })
      }
    } else {
      console.log("No stored results found, redirecting to home")
      // No results found, redirect to home
      window.location.href = '/'
      return
    }
    
    setIsLoading(false)
  }, [])

  const formatMoney = (amount: number): string => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`
    }
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return `$${amount.toLocaleString()}`
  }

  const handleBackToSearch = () => {
    console.log("Back to search clicked")
    // Clear stored results
    sessionStorage.removeItem('searchResults')
    window.location.href = '/'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="loading-container">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-xl">Loading results...</p>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center">
          <p className="text-xl mb-6">No results found</p>
          <button onClick={handleBackToSearch} className="btn-back">
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
            {results.searchTitle || "Search Results"}
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-accent to-success mx-auto"></div>
        </div>

        {/* Error Message */}
        {results.error && (
          <div className="mb-8">
            <div className="error-message">
              <p className="text-lg">Error: {results.error}</p>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {results.targets && results.targets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {results.targets.map((target, index) => (
              <div key={target.id} className="card hover:scale-105 transition-transform duration-300">
                {/* Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-text-primary mb-2 truncate">
                    <a 
                      href={target.nation_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors"
                    >
                      {target.name}
                    </a>
                  </h3>
                  <p className="text-gray-400 text-sm">
                    <strong>Alliance:</strong> {target.alliance || 'N/A'}
                  </p>
                  <p className="military-stat">
                    <strong>Score:</strong> {target.score?.toFixed(2) || 'N/A'}
                  </p>
                </div>

                {/* Key Stats */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <span className="text-sm">
                      <strong>GNI:</strong> <span className="money-amount">{formatMoney(target.gni || 0)}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-sm">
                      <strong>Daily:</strong> <span className="money-amount">{formatMoney(target.daily_income || 0)}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" />
                    <span className="text-sm">
                      <strong>Def Wars:</strong> {target.defensive_wars_count || 0}
                    </span>
                  </div>

                  {target.beige_turns !== undefined && (
                    <div className="bg-accent/20 border border-accent rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold text-accent">
                          Beige Turns: {target.beige_turns}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Sword className="w-4 h-4 text-accent" />
                    <span className="text-sm">
                      <strong>7d Stolen:</strong> <span className="money-amount">{formatMoney(target.seven_days_stolen || 0)}</span>
                    </span>
                  </div>

                  {target.one_day_stolen !== undefined && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-accent" />
                      <span className="text-sm">
                        <strong>1d Stolen:</strong> <span className="money-amount">{formatMoney(target.one_day_stolen || 0)}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Military Section */}
                <div className="border-t border-border-color pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">Military</h4>
                  <div className="space-y-1 text-xs">
                    <div className="military-stat">
                      Sol: {target.soldiers?.toLocaleString() || 0} | Tanks: {target.tanks?.toLocaleString() || 0}
                    </div>
                    <div className="military-stat">
                      Air: {target.aircraft?.toLocaleString() || 0} | Ships: {target.ships?.toLocaleString() || 0}
                    </div>
                    <div className="military-stat">
                      Miss: {target.missiles?.toLocaleString() || 0} | Nukes: {target.nukes?.toLocaleString() || 0} | Spies: {target.spies?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>

                {/* Commerce Section */}
                <div className="border-t border-border-color pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-text-primary mb-2">Commerce</h4>
                  <div className="space-y-1 text-xs">
                    <div className="military-stat">
                      Mrkt: {target.supermarket || 0} | Bank: {target.bank || 0} | Mall: {target.shopping_mall || 0}
                    </div>
                    <div className="military-stat">
                      Stad: {target.stadium || 0} | Sub: {target.subway || 0}
                    </div>
                  </div>
                </div>

                {/* View Nation Button */}
                <a 
                  href={target.nation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Nation
                </a>
              </div>
            ))}
          </div>
        )}

        {/* No Targets Message */}
        {results.targets && results.targets.length === 0 && !results.error && (
          <div className="card text-center mb-8">
            <p className="text-xl text-gray-300">No targets found matching your criteria.</p>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center">
          <button 
            onClick={handleBackToSearch}
            className="btn-back flex items-center gap-3 mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Search
          </button>
        </div>
      </div>
    </div>
  )
}