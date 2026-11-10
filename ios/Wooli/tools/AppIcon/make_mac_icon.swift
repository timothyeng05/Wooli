// Makes the Mac app icon sizes from the iPhone's square AppIcon.png.
// macOS doesn't mask icons the way iOS does, so this draws Apple's Mac icon
// grid itself: an 824 pt rounded square (radius 185) centred on a 1024 canvas,
// with a soft shadow, then writes every size the Mac asset slots need.
//
// Run from ios/Wooli:  swift tools/AppIcon/make_mac_icon.swift
import AppKit

let set = URL(fileURLWithPath: "Wooli/Assets.xcassets/AppIcon.appiconset")
guard let source = NSImage(contentsOf: set.appending(path: "AppIcon.png")),
      let cgSource = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fatalError("AppIcon.png not found; run from ios/Wooli")
}

func render(pixels: Int) -> Data {
    let scale = CGFloat(pixels) / 1024
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let ctx = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0,
                        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.scaleBy(x: scale, y: scale)
    let body = CGRect(x: 100, y: 100, width: 824, height: 824)
    let shape = CGPath(roundedRect: body, cornerWidth: 185, cornerHeight: 185, transform: nil)
    // Shadow under the tile (offset down; CG's origin is bottom-left).
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 20, color: CGColor(gray: 0, alpha: 0.3))
    ctx.addPath(shape)
    ctx.setFillColor(CGColor(gray: 0, alpha: 1))
    ctx.fillPath()
    ctx.restoreGState()
    // The artwork, clipped to the tile.
    ctx.addPath(shape)
    ctx.clip()
    ctx.interpolationQuality = .high
    ctx.draw(cgSource, in: body)
    let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
    return rep.representation(using: .png, properties: [:])!
}

var images: [[String: String]] = [
    ["filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"]
]
for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let name = "AppIcon-mac-\(points)@\(scale)x.png"
        try! render(pixels: points * scale).write(to: set.appending(path: name))
        images.append(["filename": name, "idiom": "mac", "scale": "\(scale)x", "size": "\(points)x\(points)"])
    }
}
let json: [String: Any] = ["images": images, "info": ["author": "xcode", "version": 1]]
let data = try! JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted, .sortedKeys])
try! data.write(to: set.appending(path: "Contents.json"))
print("Wrote \(images.count - 1) Mac icon sizes")
