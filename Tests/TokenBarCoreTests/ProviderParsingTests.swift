import XCTest
import TokenBarCore

final class ProviderParsingTests: XCTestCase {
    func testClaudeWindows() {
        let json = """
        {
          "five_hour": {"utilization": 42.5, "resets_at": "2026-11-21T18:00:00Z"},
          "seven_day": {"utilization": 75, "resets_at": "2026-11-28T00:00:00Z"},
          "seven_day_sonnet": {"utilization": 10, "resets_at": "2026-11-28T00:00:00Z"},
          "extra_usage": {
            "is_enabled": true,
            "monthly_limit": 200,
            "used_credits": 20,
            "utilization": 10
          }
        }
        """.data(using: .utf8)!

        let windows = ClaudeProvider.parseWindows(json)
        XCTAssertEqual(windows.count, 4)
        XCTAssertEqual(windows[0].title, "5 小时")
        XCTAssertEqual(windows[0].usedPercent, 42.5)
        XCTAssertEqual(windows[1].title, "每周")
        XCTAssertEqual(windows[2].title, "每周 · Sonnet")
        XCTAssertEqual(windows[3].title, "额外用量")
        XCTAssertEqual(windows[3].detail, "$20.00 / $200.00")
    }

    func testCodexUsage() {
        let json = """
        {
          "plan_type": "plus",
          "rate_limit": {
            "primary_window": {
              "used_percent": 100,
              "limit_window_seconds": 18000,
              "reset_at": 1795280936
            },
            "secondary_window": {
              "used_percent": 0,
              "limit_window_seconds": 604800,
              "reset_at": 1795879023
            }
          },
          "credits": {"has_credits": true, "unlimited": false, "balance": "12.5"}
        }
        """.data(using: .utf8)!

        let parsed = CodexProvider.parseUsage(json)
        XCTAssertEqual(parsed.plan, "Plus")
        XCTAssertEqual(parsed.windows.count, 2)
        XCTAssertEqual(parsed.windows[0].title, "5 小时")
        XCTAssertEqual(parsed.windows[0].usedPercent, 100)
        XCTAssertEqual(parsed.windows[1].title, "每周")
        XCTAssertEqual(parsed.creditBalance, "余额 12.5")
    }

    func testAntigravityGroups() {
        let json = """
        {
          "command": {
            "name": "usage",
            "data": {
              "groups": [
                {
                  "name": "Gemini Models",
                  "buckets": [
                    {"id": "gemini-weekly", "name": "Weekly Limit Remaining", "window": "weekly", "remaining_fraction": 0.75, "reset_time": "2026-11-28T08:56:02Z"},
                    {"id": "gemini-5h", "name": "Five Hour Limit Remaining", "window": "5h", "remaining_fraction": 1, "reset_time": "2026-11-21T20:37:47Z"}
                  ]
                },
                {
                  "name": "Claude and GPT models",
                  "buckets": [
                    {"id": "3p-weekly", "name": "Weekly Limit Remaining", "window": "weekly", "remaining_fraction": 1, "reset_time": "2026-11-28T15:37:47Z"},
                    {"id": "3p-5h", "name": "Five Hour Limit Remaining", "window": "5h", "remaining_fraction": 1, "reset_time": "2026-11-21T20:37:47Z"}
                  ]
                },
                {
                  "name": "Gemini 4 Argon",
                  "buckets": [
                    {"id": "gemini-argon-wtu-weekly", "name": "Gemini 4 Argon Weekly Limit", "window": "weekly", "remaining_fraction": 1, "reset_time": "2026-11-28T15:37:47Z"}
                  ]
                }
              ]
            }
          }
        }
        """.data(using: .utf8)!

        let parsed = AntigravityProvider.parseOutput(json)
        XCTAssertEqual(parsed.windows.map(\.title), [
            "Gemini · 5 小时",
            "Gemini · 每周",
            "Claude + GPT · 5 小时",
            "Claude + GPT · 每周",
        ])
        XCTAssertEqual(parsed.windows[0].usedPercent ?? -1, 0, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[1].usedPercent ?? -1, 25, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[2].usedPercent ?? -1, 0, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[3].usedPercent ?? -1, 0, accuracy: 0.001)
    }

    func testAntigravityShowsExtraGroupWhenUsed() {
        let json = """
        {
          "command": {
            "data": {
              "groups": [
                {"name": "Gemini Models", "buckets": [
                  {"id": "gemini-5h", "name": "Five Hour Limit Remaining", "window": "5h", "remaining_fraction": 1}
                ]},
                {"name": "Gemini 4 Argon", "buckets": [
                  {"id": "gemini-argon-wtu-weekly", "name": "Gemini 4 Argon Weekly Limit", "window": "weekly", "remaining_fraction": 0.5}
                ]}
              ]
            }
          }
        }
        """.data(using: .utf8)!

        let parsed = AntigravityProvider.parseOutput(json)
        XCTAssertEqual(parsed.windows.count, 2)
        XCTAssertEqual(parsed.windows.last?.title, "Gemini 4 Argon · 每周")
        XCTAssertEqual(parsed.windows.last?.usedPercent ?? -1, 50, accuracy: 0.001)
    }

    func testCursorUsage() {
        let json = """
        {
          "billingCycleEnd": "2026-12-01T00:00:00Z",
          "membershipType": "pro",
          "individualUsage": {
            "plan": {
              "used": 100,
              "limit": 2000,
              "totalPercentUsed": 5,
              "autoPercentUsed": 4,
              "apiPercentUsed": 6
            },
            "onDemand": {"used": 100, "limit": 1000}
          }
        }
        """.data(using: .utf8)!

        let parsed = CursorProvider.parseUsage(json)
        XCTAssertEqual(parsed.plan, "Pro")
        XCTAssertEqual(parsed.windows.count, 2)
        XCTAssertEqual(parsed.windows[0].usedPercent, 5)
        XCTAssertEqual(parsed.windows[0].detail, "$1.00 / $20.00")
        XCTAssertEqual(parsed.windows[1].usedPercent, 10)
    }

    func testCopilotUsage() {
        let json = """
        {
          "access_type_sku": "free_limited_copilot",
          "copilot_plan": "individual",
          "quota_reset_date": "2026-12-01",
          "quota_snapshots": {
            "premium_interactions": {
              "percent_remaining": 0,
              "entitlement": 50,
              "remaining": 0,
              "credits_used": 5
            },
            "chat": {
              "percent_remaining": 100,
              "entitlement": 100,
              "remaining": 100
            }
          }
        }
        """.data(using: .utf8)!

        let parsed = CopilotProvider.parseUsage(json)
        XCTAssertEqual(parsed.plan, "Individual")
        XCTAssertFalse(parsed.subscriptionEnded)
        XCTAssertEqual(parsed.windows.count, 2)
        XCTAssertEqual(parsed.windows[0].title, "Premium requests")
        XCTAssertEqual(parsed.windows[0].usedPercent, 100)
        XCTAssertEqual(parsed.windows[1].usedPercent, 0)
    }

    func testKimiUsagePools() {
        let json = """
        {
          "usages": {
            "limit_5h": {"used_ratio": 0.1, "reset_time": "2026-11-21T18:00:00Z"},
            "limit_7d": {"used_ratio": 0.5},
            "limit_month_total": {"used_ratio": 0.8}
          },
          "user": {"membership": {"level": "LEVEL_BASIC"}}
        }
        """.data(using: .utf8)!

        let parsed = KimiProvider.parseUsage(json)
        XCTAssertEqual(parsed.plan, "Moderato")
        XCTAssertEqual(parsed.windows.map(\.title), ["5 小时", "每周", "本月"])
        XCTAssertEqual(parsed.windows[0].usedPercent ?? -1, 10, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[1].usedPercent ?? -1, 50, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[2].usedPercent ?? -1, 80, accuracy: 0.001)
    }

    func testNousAccount() {
        let json = """
        {
          "subscription": {
            "monthly_credits": 100,
            "credits_remaining": 75,
            "current_period_end": "2026-12-01T00:00:00Z",
            "plan": "ultra"
          },
          "purchased_credits_remaining": 10,
          "paid_service_access": {"total_usable_credits": 85}
        }
        """.data(using: .utf8)!

        let parsed = NousProvider.parseAccount(json)
        XCTAssertEqual(parsed.plan, "Ultra")
        XCTAssertEqual(parsed.windows.count, 1)
        XCTAssertEqual(parsed.windows[0].usedPercent ?? -1, 25, accuracy: 0.001)
        XCTAssertEqual(parsed.creditBalance, "可用 85 credits")
    }

    func testWindsurfCachedPlan() {
        let json = """
        {
          "planName": "Pro",
          "quotaUsage": {
            "dailyRemainingPercent": 80,
            "weeklyRemainingPercent": 60,
            "dailyResetAtUnix": 1795280936,
            "weeklyResetAtUnix": 1795879023
          }
        }
        """.data(using: .utf8)!

        let parsed = WindsurfProvider.parsePlan(json)
        XCTAssertEqual(parsed.plan, "Pro")
        XCTAssertEqual(parsed.windows.count, 2)
        XCTAssertEqual(parsed.windows[0].usedPercent ?? -1, 20, accuracy: 0.001)
        XCTAssertEqual(parsed.windows[1].usedPercent ?? -1, 40, accuracy: 0.001)
    }
}
