import Foundation

// Income tax on salary entered before tax. 2026 figures, treated as today's
// dollars and assumed to rise with inflation (as brackets are indexed), so the
// projection applies them to real (today's-dollar) wages every year.
//
// Sources: IRS Rev. Proc. 2025-32 (federal brackets, standard deduction); SSA
// 2026 wage base; IRS 2026 401(k) limit; NY Tax Law §601 with the 2026 rate cut
// on the five lower brackets; NYC resident rates; CT DRS schedules. Estimates:
// no credits, itemizing, NY benefit recapture, CT exemption phase-outs, or tax
// on Social Security and retirement withdrawals.

enum TaxRegion: String, Codable, CaseIterable, Identifiable {
    case none, newYork, newYorkCity, connecticut, other
    var id: String { rawValue }

    var label: String {
        switch self {
        case .none: "No state income tax"
        case .newYork: "New York State"
        case .newYorkCity: "New York City"
        case .connecticut: "Connecticut"
        case .other: "Other state (flat rate)"
        }
    }
}

enum FilingStatus: String, Codable, CaseIterable, Identifiable {
    case single, joint
    var id: String { rawValue }
    var label: String { self == .single ? "Each files single" : "Married filing jointly" }
}

enum ForecastTax {
    struct Bracket { let upTo: Double; let rate: Double }

    struct Schedule {
        let deduction: Double
        let brackets: [Bracket]

        func tax(on income: Double) -> Double {
            var remaining = max(income - deduction, 0)
            var lower = 0.0, total = 0.0
            for b in brackets where remaining > 0 {
                let span = min(remaining, b.upTo - lower)
                total += span * b.rate
                remaining -= span
                lower = b.upTo
            }
            return total
        }
    }

    static let socialSecurityWageBase = 184_500.0
    static let retirementContributionLimit = 24_500.0

    static let federalSingle = Schedule(deduction: 16_100, brackets: [
        .init(upTo: 12_400, rate: 0.10), .init(upTo: 50_400, rate: 0.12), .init(upTo: 105_700, rate: 0.22),
        .init(upTo: 201_775, rate: 0.24), .init(upTo: 256_225, rate: 0.32), .init(upTo: 640_600, rate: 0.35),
        .init(upTo: .infinity, rate: 0.37),
    ])
    static let federalJoint = Schedule(deduction: 32_200, brackets: [
        .init(upTo: 24_800, rate: 0.10), .init(upTo: 100_800, rate: 0.12), .init(upTo: 211_400, rate: 0.22),
        .init(upTo: 403_550, rate: 0.24), .init(upTo: 512_450, rate: 0.32), .init(upTo: 768_700, rate: 0.35),
        .init(upTo: .infinity, rate: 0.37),
    ])

    static let newYorkSingle = Schedule(deduction: 8_000, brackets: [
        .init(upTo: 8_500, rate: 0.039), .init(upTo: 11_700, rate: 0.044), .init(upTo: 13_900, rate: 0.0515),
        .init(upTo: 80_650, rate: 0.054), .init(upTo: 215_400, rate: 0.059), .init(upTo: 1_077_550, rate: 0.0685),
        .init(upTo: 5_000_000, rate: 0.0965), .init(upTo: 25_000_000, rate: 0.103), .init(upTo: .infinity, rate: 0.109),
    ])
    static let newYorkJoint = Schedule(deduction: 16_050, brackets: [
        .init(upTo: 17_150, rate: 0.039), .init(upTo: 23_600, rate: 0.044), .init(upTo: 27_900, rate: 0.0515),
        .init(upTo: 161_550, rate: 0.054), .init(upTo: 323_200, rate: 0.059), .init(upTo: 2_155_350, rate: 0.0685),
        .init(upTo: 5_000_000, rate: 0.0965), .init(upTo: 25_000_000, rate: 0.103), .init(upTo: .infinity, rate: 0.109),
    ])
    static let nycSingle = Schedule(deduction: 8_000, brackets: [
        .init(upTo: 12_000, rate: 0.03078), .init(upTo: 25_000, rate: 0.03762), .init(upTo: 50_000, rate: 0.03819),
        .init(upTo: .infinity, rate: 0.03876),
    ])
    static let nycJoint = Schedule(deduction: 16_050, brackets: [
        .init(upTo: 21_600, rate: 0.03078), .init(upTo: 45_000, rate: 0.03762), .init(upTo: 90_000, rate: 0.03819),
        .init(upTo: .infinity, rate: 0.03876),
    ])
    static let connecticutSingle = Schedule(deduction: 0, brackets: [
        .init(upTo: 10_000, rate: 0.02), .init(upTo: 50_000, rate: 0.045), .init(upTo: 100_000, rate: 0.055),
        .init(upTo: 200_000, rate: 0.06), .init(upTo: 250_000, rate: 0.065), .init(upTo: 500_000, rate: 0.069),
        .init(upTo: .infinity, rate: 0.0699),
    ])
    static let connecticutJoint = Schedule(deduction: 0, brackets: [
        .init(upTo: 20_000, rate: 0.02), .init(upTo: 100_000, rate: 0.045), .init(upTo: 200_000, rate: 0.055),
        .init(upTo: 400_000, rate: 0.06), .init(upTo: 500_000, rate: 0.065), .init(upTo: 1_000_000, rate: 0.069),
        .init(upTo: .infinity, rate: 0.0699),
    ])

    /// State (and city) tax on wages after pre-tax contributions.
    static func state(_ income: Double, region: TaxRegion, otherRate: Double, joint: Bool) -> Double {
        switch region {
        case .none: 0
        case .newYork: (joint ? newYorkJoint : newYorkSingle).tax(on: income)
        case .newYorkCity: (joint ? newYorkJoint : newYorkSingle).tax(on: income) + (joint ? nycJoint : nycSingle).tax(on: income)
        case .connecticut: (joint ? connecticutJoint : connecticutSingle).tax(on: income)
        case .other: max(income, 0) * otherRate
        }
    }

    /// Social Security and Medicare on one person's wages (pre-tax 401(k) is still subject to both).
    static func payroll(_ wages: Double, additionalMedicareOver threshold: Double = 200_000) -> Double {
        min(wages, socialSecurityWageBase) * 0.062 + wages * 0.0145 + max(wages - threshold, 0) * 0.009
    }

    struct Earner {
        var id: String
        /// Salary before tax, today's dollars.
        var wages: Double
        /// Pre-tax retirement contributions, today's dollars.
        var pretax: Double
        var region: TaxRegion
        var otherRate: Double
    }

    struct Bill: Equatable {
        var federal = 0.0
        var payroll = 0.0
        var state = 0.0
        var total: Double { federal + payroll + state }
    }

    /// Taxes for one year. Joint filing pools federal income; state is pooled
    /// only when both live in the same state (otherwise each pays their own).
    static func bill(_ earners: [Earner], joint: Bool) -> Bill {
        var bill = Bill()
        let working = earners.filter { $0.wages > 0 }
        guard !working.isEmpty else { return bill }
        let taxable = working.map { max($0.wages - $0.pretax, 0) }
        if joint && earners.count > 1 {
            bill.federal = federalJoint.tax(on: taxable.reduce(0, +))
            let wages = working.reduce(0) { $0 + $1.wages }
            bill.payroll = working.reduce(0) { $0 + payroll($1.wages, additionalMedicareOver: .infinity) }
                + max(wages - 250_000, 0) * 0.009
            let regions = Set(working.map(\.region))
            if regions.count == 1, let r = regions.first {
                bill.state = state(taxable.reduce(0, +), region: r, otherRate: working[0].otherRate, joint: true)
            } else {
                bill.state = zip(working, taxable).reduce(0) { $0 + state($1.1, region: $1.0.region, otherRate: $1.0.otherRate, joint: false) }
            }
        } else {
            for (e, t) in zip(working, taxable) {
                bill.federal += federalSingle.tax(on: t)
                bill.payroll += payroll(e.wages)
                bill.state += state(t, region: e.region, otherRate: e.otherRate, joint: false)
            }
        }
        return bill
    }
}
