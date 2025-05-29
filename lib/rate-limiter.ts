interface RequestLog {
  nationId: number
  timestamps: Date[]
}

class RateLimiter {
  private requestLogs: Map<number, Date[]> = new Map()
  private readonly maxRequestsPerDay = 10
  private readonly rateLimitWindow = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  checkRateLimit(nationId: number): boolean {
    console.log("Checking rate limit", { nationId })
    
    const currentTime = new Date()
    const logs = this.requestLogs.get(nationId) || []

    // Filter out old timestamps
    const validRequests = logs.filter(timestamp => 
      currentTime.getTime() - timestamp.getTime() < this.rateLimitWindow
    )

    // Update the logs with filtered timestamps
    this.requestLogs.set(nationId, validRequests)

    console.log("Rate limit check", { 
      nationId, 
      validRequestsCount: validRequests.length, 
      maxAllowed: this.maxRequestsPerDay 
    })

    return validRequests.length < this.maxRequestsPerDay
  }

  recordRequest(nationId: number): void {
    console.log("Recording request", { nationId })
    
    const currentTime = new Date()
    const logs = this.requestLogs.get(nationId) || []
    
    logs.push(currentTime)
    this.requestLogs.set(nationId, logs)
    
    console.log("Request recorded", { 
      nationId, 
      totalRequests: logs.length 
    })
  }

  getRemainingRequests(nationId: number): number {
    const currentTime = new Date()
    const logs = this.requestLogs.get(nationId) || []

    // Filter out old timestamps
    const validRequests = logs.filter(timestamp => 
      currentTime.getTime() - timestamp.getTime() < this.rateLimitWindow
    )

    return Math.max(0, this.maxRequestsPerDay - validRequests.length)
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()