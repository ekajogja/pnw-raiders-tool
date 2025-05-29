'use client'

import { useState } from 'react'
import { Search, Target, Shield } from 'lucide-react'

export default function HomePage() {
  const [nationId, setNationId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showWarning, setShowWarning] = useState(false)

  console.log("HomePage rendered", { nationId, isLoading })

  const handleSubmit = async (searchType: 'raid' | 'beige') => {
    console.log("Form submitted", { searchType, nationId })
    
    if (!nationId.trim()) {
      console.log("No nation ID provided, showing warning")
      setShowWarning(true)
      return
    }
    
    setShowWarning(false)
    setIsLoading(true)
    
    console.log("Redirecting to search results", { searchType, nationId })
    
    const formData = new FormData()
    formData.append('nation_id', nationId)
    
    try {
      const response = await fetch(`/api/${searchType}`, {
        method: 'POST',
        body: formData,
      })
      
      console.log("API response received", { status: response.status })
      
      if (response.ok) {
        const data = await response.json()
        console.log("Search results received", { resultsCount: data.targets?.length })
        
        // Store results in sessionStorage and redirect
        sessionStorage.setItem('searchResults', JSON.stringify(data))
        window.location.href = '/results'
      } else {
        const errorData = await response.json()
        console.log("API error", { error: errorData })
        
        // Store error and redirect to results
        sessionStorage.setItem('searchResults', JSON.stringify({
          error: errorData.error,
          searchTitle: errorData.searchTitle || `Error for Nation ID ${nationId}`
        }))
        window.location.href = '/results'
      }
    } catch (error) {
      console.error("Network error:", error)
      
      sessionStorage.setItem('searchResults', JSON.stringify({
        error: "Network error occurred. Please try again.",
        searchTitle: "Network Error"
      }))
      window.location.href = '/results'
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="samurai-title">
            Politics & War
          </h1>
          <h2 className="subtitle">
            Raiders&apos; Tool
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-accent to-success mx-auto mt-6"></div>
        </div>

        {/* Search Form */}
        <div className="card">
          <div className="mb-8">
            <label 
              htmlFor="nation_id" 
              className="block text-lg font-semibold mb-3 text-text-primary"
            >
              Your Nation ID:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="number"
                id="nation_id"
                value={nationId}
                onChange={(e) => {
                  console.log("Nation ID input changed", { value: e.target.value })
                  setNationId(e.target.value)
                  setShowWarning(false)
                }}
                placeholder="Enter your nation ID"
                className="input-field w-full pl-11 text-lg"
                required
              />
            </div>
            {showWarning && (
              <p className="mt-3 text-accent font-medium">
                Nation ID is required
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => handleSubmit('raid')}
              disabled={isLoading}
              className="btn-secondary flex-1 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Target className="w-6 h-6" />
              Find Raid Targets
            </button>
            
            <button
              onClick={() => handleSubmit('beige')}
              disabled={isLoading}
              className="btn-primary flex-1 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="w-6 h-6" />
              Find Beige Targets
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-container mt-8">
            <p className="text-xl font-semibold mb-4 text-accent">
              Please wait. Don&apos;t reload this page.
            </p>
            <p className="text-gray-300 mb-6">
              Search process can take up to 3 minutes to get live data from Politics & War server.
            </p>
            <div className="spinner mx-auto mb-6"></div>
            <p className="text-gray-400">
              Loading up to 5,000 nations data...
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-16 pt-8 border-t border-border-color">
          <div className="w-32 h-1 bg-gradient-to-r from-success to-accent mx-auto mb-6"></div>
          <p className="text-gray-300">
            Built with ❤️ by{' '}
            <a 
              href="https://politicsandwar.com/nation/id=684074" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-success hover:text-success/80 font-semibold transition-colors"
            >
              Bako Gayo
            </a>
            , the dastard{' '}
            <a 
              href="https://politicsandwar.com/alliance/id=10304" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent/80 font-semibold transition-colors"
            >
              Samurai
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  )
}