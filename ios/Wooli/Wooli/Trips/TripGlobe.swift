import SwiftUI
import CoreLocation

// The flight globe: real coastlines on an orthographic (seen-from-space)
// projection with the great-circle route on top. Drawn ourselves rather
// than with MapKit so it works offline (on the plane) and keeps the dark,
// outlined look of the ticket.

/// Land outlines from `coastlines.bin` (Natural Earth 1:110m, public domain;
/// rebuild with `ios/Wooli/tools/build_coastlines.mjs`). Rings of
/// (longitude, latitude) in degrees.
enum Coastlines {
    static let rings: [[SIMD2<Double>]] = {
        guard let url = Bundle.main.url(forResource: "coastlines", withExtension: "bin"),
              let data = try? Data(contentsOf: url) else { return [] }
        let bytes = [UInt8](data)
        func u16(_ i: Int) -> UInt16 { UInt16(bytes[i]) | UInt16(bytes[i + 1]) << 8 }
        func degrees(_ i: Int) -> Double { Double(Int16(bitPattern: u16(i))) / 100 }
        var rings: [[SIMD2<Double>]] = []
        var i = 0
        while i + 2 <= bytes.count {
            let count = Int(u16(i))
            i += 2
            guard i + count * 4 <= bytes.count else { break }
            rings.append((0..<count).map { n in SIMD2(degrees(i + n * 4), degrees(i + n * 4 + 2)) })
            i += count * 4
        }
        return rings
    }()
}

/// Points along the shortest path over the globe between two places.
func greatCircle(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D, steps: Int) -> [CLLocationCoordinate2D] {
    func vector(_ c: CLLocationCoordinate2D) -> SIMD3<Double> {
        let φ = c.latitude * .pi / 180, λ = c.longitude * .pi / 180
        return SIMD3(cos(φ) * cos(λ), cos(φ) * sin(λ), sin(φ))
    }
    let va = vector(a), vb = vector(b)
    let angle = acos(max(-1, min(1, (va * vb).sum())))
    guard angle > 1e-6 else { return [a, b] }
    return (0...steps).map { step in
        let t = Double(step) / Double(steps)
        let v = va * (sin((1 - t) * angle) / sin(angle)) + vb * (sin(t * angle) / sin(angle))
        return CLLocationCoordinate2D(latitude: asin(max(-1, min(1, v.z))) * 180 / .pi, longitude: atan2(v.y, v.x) * 180 / .pi)
    }
}

/// The globe as seen from space above `center`.
private struct Orthographic {
    let origin: CGPoint
    let radius: CGFloat
    private let λ0: Double, sinφ0: Double, cosφ0: Double

    init(center: CLLocationCoordinate2D, origin: CGPoint, radius: CGFloat) {
        self.origin = origin
        self.radius = radius
        λ0 = center.longitude * .pi / 180
        sinφ0 = sin(center.latitude * .pi / 180)
        cosφ0 = cos(center.latitude * .pi / 180)
    }

    /// Screen point and whether it faces us. Points on the far side are
    /// pushed out to the rim, so land that wraps around the edge still fills.
    func project(longitude: Double, latitude: Double) -> (point: CGPoint, visible: Bool) {
        let φ = latitude * .pi / 180, λ = longitude * .pi / 180 - λ0
        var x = cos(φ) * sin(λ)
        var y = cosφ0 * sin(φ) - sinφ0 * cos(φ) * cos(λ)
        let visible = sinφ0 * sin(φ) + cosφ0 * cos(φ) * cos(λ) >= 0
        if !visible {
            let length = hypot(x, y)
            if length > 0 {
                x /= length
                y /= length
            }
        }
        return (CGPoint(x: origin.x + radius * x, y: origin.y - radius * y), visible)
    }

    func project(_ c: CLLocationCoordinate2D) -> (point: CGPoint, visible: Bool) {
        project(longitude: c.longitude, latitude: c.latitude)
    }
}

struct RouteGlobe: View {
    let from: CLLocationCoordinate2D?
    let to: CLLocationCoordinate2D?
    /// What to face when there's no route yet.
    let focus: CLLocationCoordinate2D
    var fromLabel = ""
    var toLabel = ""
    let accent: Color

    private static let ocean = (top: Color(hex: "#13213d"), bottom: Color(hex: "#070d1c"))
    private static let land = Color(hex: "#22314f")
    private static let coast = Color(hex: "#3a4c72")
    private static let grid = Color(hex: "#1d2b4a")

    var body: some View {
        Canvas { context, size in
            drawStars(in: &context, size: size)

            let route = from.flatMap { a in to.map { greatCircle(a, $0, steps: 96) } }
            let center = route.map { $0[$0.count / 2] } ?? from ?? to ?? focus
            let radius = min(size.width, size.height) * 0.29
            let globe = Orthographic(center: center, origin: CGPoint(x: size.width / 2, y: size.height * 0.56), radius: radius)
            let disc = Path(ellipseIn: CGRect(x: globe.origin.x - radius, y: globe.origin.y - radius, width: radius * 2, height: radius * 2))

            // Atmosphere glow, then the ocean.
            let halo = radius * 1.1
            context.fill(Path(ellipseIn: CGRect(x: globe.origin.x - halo, y: globe.origin.y - halo, width: halo * 2, height: halo * 2)),
                         with: .radialGradient(Gradient(stops: [.init(color: accent.opacity(0), location: 0.86),
                                                                .init(color: accent.opacity(0.35), location: 0.93),
                                                                .init(color: accent.opacity(0), location: 1)]),
                                               center: globe.origin, startRadius: 0, endRadius: halo))
            context.fill(disc, with: .radialGradient(Gradient(colors: [Self.ocean.top, Self.ocean.bottom]),
                                                     center: CGPoint(x: globe.origin.x - radius * 0.3, y: globe.origin.y - radius * 0.35),
                                                     startRadius: 0, endRadius: radius * 1.3))

            var inside = context
            inside.clip(to: disc)
            drawGraticule(in: &inside, globe: globe)
            drawLand(in: &inside, globe: globe)
            if let route { drawRoute(route, in: &inside, globe: globe) }
        }
        .accessibilityHidden(true)
    }

    private func drawStars(in context: inout GraphicsContext, size: CGSize) {
        // Same sky every time: a tiny fixed-seed generator.
        var seed: UInt32 = 7
        func next() -> CGFloat {
            seed = seed &* 1_664_525 &+ 1_013_904_223
            return CGFloat(seed >> 8) / CGFloat(1 << 24)
        }
        for _ in 0..<70 {
            let x = next() * size.width, y = next() * size.height * 0.8, r = 0.4 + next()
            context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)), with: .color(.white.opacity(0.2 + 0.5 * next())))
        }
    }

    /// Strokes only the parts of a line that face us.
    private func visiblePath(_ points: [(point: CGPoint, visible: Bool)]) -> Path {
        var path = Path()
        var drawing = false
        for p in points {
            if p.visible && drawing {
                path.addLine(to: p.point)
            } else if p.visible {
                path.move(to: p.point)
            }
            drawing = p.visible
        }
        return path
    }

    private func drawGraticule(in context: inout GraphicsContext, globe: Orthographic) {
        var path = Path()
        for lon in stride(from: -180.0, to: 180, by: 15) {
            path.addPath(visiblePath(stride(from: -90.0, through: 90, by: 3).map { globe.project(longitude: lon, latitude: $0) }))
        }
        for lat in stride(from: -75.0, through: 75, by: 15) {
            path.addPath(visiblePath(stride(from: -180.0, through: 180, by: 3).map { globe.project(longitude: $0, latitude: lat) }))
        }
        context.stroke(path, with: .color(Self.grid), lineWidth: 0.6)
    }

    private func drawLand(in context: inout GraphicsContext, globe: Orthographic) {
        var fill = Path(), coast = Path()
        for ring in Coastlines.rings {
            let points = ring.map { globe.project(longitude: $0.x, latitude: $0.y) }
            // A ring entirely on the far side would collapse onto the rim.
            guard points.contains(where: \.visible), let first = points.first else { continue }
            fill.move(to: first.point)
            for p in points.dropFirst() { fill.addLine(to: p.point) }
            fill.closeSubpath()
            // Outline the coast, but not the seam where land is cut at ±180°.
            for (i, p) in points.enumerated().dropFirst() where p.visible && points[i - 1].visible {
                if abs(ring[i].x) > 179.9 && abs(ring[i - 1].x) > 179.9 { continue }
                coast.move(to: points[i - 1].point)
                coast.addLine(to: p.point)
            }
        }
        context.fill(fill, with: .color(Self.land))
        context.stroke(coast, with: .color(Self.coast), lineWidth: 0.7)
    }

    private func drawRoute(_ route: [CLLocationCoordinate2D], in context: inout GraphicsContext, globe: Orthographic) {
        let projected = route.map { globe.project($0) }
        let line = visiblePath(projected)
        let start = projected[0], end = projected[projected.count - 1]

        context.drawLayer { glow in
            glow.addFilter(.blur(radius: 4))
            glow.stroke(line, with: .color(accent.opacity(0.6)), lineWidth: 8)
        }
        context.stroke(line, with: .linearGradient(Gradient(colors: [Color(white: 0.85), accent]),
                                                   startPoint: start.point, endPoint: end.point),
                       style: StrokeStyle(lineWidth: 3, lineCap: .round))

        // The plane halfway, pointing along the route.
        let mid = projected[projected.count / 2], ahead = projected[projected.count / 2 + 1]
        if mid.visible {
            context.drawLayer { plane in
                plane.translateBy(x: mid.point.x, y: mid.point.y)
                plane.fill(Path(ellipseIn: CGRect(x: -15, y: -15, width: 30, height: 30)), with: .color(.white))
                plane.rotate(by: .radians(atan2(ahead.point.y - mid.point.y, ahead.point.x - mid.point.x)))
                plane.draw(Text(Image(systemName: "airplane")).font(.system(size: 14, weight: .bold)).foregroundStyle(Color(hex: "#2563eb")),
                           at: .zero)
            }
        }

        if start.visible {
            context.fill(dot(start.point, 6), with: .color(Color(hex: "#050812")))
            context.stroke(dot(start.point, 6), with: .color(Color(white: 0.9)), lineWidth: 3)
            label(fromLabel, at: start.point, toward: end.point, in: &context)
        }
        if end.visible {
            context.fill(dot(end.point, 13), with: .color(accent.opacity(0.35)))
            context.fill(dot(end.point, 6.5), with: .color(accent))
            context.stroke(dot(end.point, 6.5), with: .color(.white), lineWidth: 2)
            label(toLabel, at: end.point, toward: start.point, in: &context)
        }
    }

    private func dot(_ p: CGPoint, _ r: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2))
    }

    /// Puts the code on the side of the pin away from the route.
    private func label(_ text: String, at p: CGPoint, toward other: CGPoint, in context: inout GraphicsContext) {
        guard !text.isEmpty else { return }
        let dx = p.x - other.x, dy = p.y - other.y, length = max(hypot(dx, dy), 1)
        context.draw(Text(text).font(.caption2.weight(.heavy)).foregroundStyle(.white),
                     at: CGPoint(x: p.x + dx / length * 22, y: p.y + dy / length * 22))
    }
}
