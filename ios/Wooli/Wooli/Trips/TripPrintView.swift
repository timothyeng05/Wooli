#if os(macOS)
import AppKit
import SwiftUI

/// M2-5: Print… (⌘P) and Export as PDF. The itinerary is drawn as plain,
/// black-on-white text (no app chrome, no open slots) in an NSTextView so the
/// system print panel does the paging, and its PDF button does Export as PDF.
@MainActor
enum TripPrinter {
    /// Opens the system print panel for `trip`'s itinerary.
    static func printItinerary(trip: Trip, items: [TripItem], options: ExportOptions) {
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.topMargin = 54; info.bottomMargin = 54; info.leftMargin = 54; info.rightMargin = 54
        info.isVerticallyCentered = false
        let width = (info.paperSize.width - info.leftMargin - info.rightMargin)
        let view = textView(trip: trip, items: items, options: options, width: width)
        let operation = NSPrintOperation(view: view, printInfo: info)
        operation.jobTitle = TripExport.title(trip)
        operation.showsPrintPanel = true
        operation.run()
    }

    /// The finished document as PDF data (used for Export as PDF without the panel).
    static func pdfData(trip: Trip, items: [TripItem], options: ExportOptions) -> Data {
        let view = textView(trip: trip, items: items, options: options, width: 504)
        return view.dataWithPDF(inside: view.bounds)
    }

    static func textView(trip: Trip, items: [TripItem], options: ExportOptions, width: CGFloat) -> NSTextView {
        let view = NSTextView(frame: NSRect(x: 0, y: 0, width: width, height: 10))
        view.isEditable = false
        view.drawsBackground = true
        view.backgroundColor = .white
        view.textContainerInset = .zero
        view.textStorage?.setAttributedString(attributed(trip: trip, items: items, options: options))
        view.textContainer?.containerSize = NSSize(width: width, height: .greatestFiniteMagnitude)
        view.textContainer?.widthTracksTextView = true
        view.isVerticallyResizable = true
        view.layoutManager?.ensureLayout(for: view.textContainer!)
        view.sizeToFit()
        return view
    }

    /// Cover title, a city line, day headings in bold, plans with their detail lines under them.
    static func attributed(trip: Trip, items: [TripItem], options: ExportOptions) -> NSAttributedString {
        var plain = options
        plain.markdown = false
        let body = NSFont.systemFont(ofSize: 11)
        let bold = NSFont.boldSystemFont(ofSize: 12)
        let result = NSMutableAttributedString()
        func add(_ text: String, font: NSFont, color: NSColor = .black, before: CGFloat = 0) {
            let style = NSMutableParagraphStyle()
            style.paragraphSpacingBefore = before
            style.lineSpacing = 2
            // Keep a day's heading with the lines under it where the printer allows.
            style.lineBreakMode = .byWordWrapping
            result.append(NSAttributedString(string: text + "\n", attributes: [.font: font, .foregroundColor: color, .paragraphStyle: style]))
        }
        let lines = TripExport.itinerary(trip: trip, items: items, options: plain).components(separatedBy: "\n")
        let cities = Set(trip.awayLegs.map(\.name))
        for (i, line) in lines.enumerated() {
            if line.isEmpty { continue }
            if i == 0 { add(line, font: .boldSystemFont(ofSize: 22)) }
            else if i == 1 { add(line, font: .systemFont(ofSize: 12), color: .darkGray) }
            else if !line.hasPrefix(" "), cities.contains(line) { add(line.uppercased(), font: .boldSystemFont(ofSize: 14), before: 18) }
            else if !line.hasPrefix(" ") { add(line, font: bold, before: 10) }
            else if line.hasPrefix("    ") { add(line, font: .systemFont(ofSize: 10), color: .darkGray) }
            else { add(line, font: body, before: 2) }
        }
        return result
    }
}
#endif
