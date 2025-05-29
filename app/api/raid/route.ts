import { NextRequest, NextResponse } from 'next/server'
import { findRaidTargets } from '@/lib/raid-finder'
import { rateLimiter } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  console.log("Raid API endpoint called")
  
  try {
    const formData = await request.formData()
    const nationIdStr = formData.get('nation_id') as string
    
    console.log("Received form data", { nationIdStr })
    
    if (!nationIdStr) {
      console.log("Nation ID not provided")
      return NextResponse.json(
        { 
          error: "Nation ID is required. Please enter a Nation ID.",
          searchTitle: "Input Error"
        },
        { status: 400 }
      )
    }
    
    let nationId: number
    try {
      nationId = parseInt(nationIdStr)
      console.log("Parsed nation ID", { nationId })
    } catch {
      console.log("Invalid nation ID format")
      return NextResponse.json(
        {
          error: "Invalid Nation ID format. Please enter a number.",
          searchTitle: "Invalid Input"
        },
        { status: 400 }
      )
    }
    
    const apiKey = process.env.PNW_API_KEY
    if (!apiKey) {
      console.error("PNW_API_KEY not configured")
      return NextResponse.json(
        {
          error: "Critical error: API key not configured on the server. Please contact the administrator.",
          searchTitle: "Server Configuration Error"
        },
        { status: 500 }
      )
    }
    
    // Check rate limit
    if (!rateLimiter.checkRateLimit(nationId)) {
      console.log("Rate limit exceeded", { nationId })
      return NextResponse.json(
        {
          error: `Rate limit exceeded for Nation ID ${nationId}. Only 10 requests allowed per 24 hours.`,
          searchTitle: `Rate Limit Exceeded for Nation ID ${nationId}`
        },
        { status: 429 }
      )
    }
    
    console.log("Starting raid target search")
    
    try {
      const { myNation, targets } = await findRaidTargets(apiKey, nationId, 10, 10)
      
      // Record the request after successful processing
      rateLimiter.recordRequest(nationId)
      
      console.log("Raid search completed", { 
        targetsFound: targets.length,
        userNation: myNation.nation_name 
      })
      
      return NextResponse.json({
        targets,
        searchTitle: `Raid Targets for Nation ID ${nationId}`,
        myNation
      })
      
    } catch (error) {
      console.error("Error in raid target search:", error)
      
      if (error instanceof Error) {
        return NextResponse.json(
          {
            error: error.message,
            searchTitle: `Error for Nation ID ${nationId}`
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        {
          error: "An unexpected server error occurred. Please try again later or contact support.",
          searchTitle: "Unexpected Server Error"
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error("Unexpected error in raid API:", error)
    
    return NextResponse.json(
      {
        error: "An unexpected server error occurred. Please try again later or contact support.",
        searchTitle: "Unexpected Server Error"
      },
      { status: 500 }
    )
  }
}