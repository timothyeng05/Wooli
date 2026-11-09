// Encodes a folder of PNG frames into an animated HEIC (24 fps, plays once). Used by make_splash.sh.
// swiftc -O heics.swift -o heics && ./heics <frames-dir> <out.heics> <quality 0-1>
import Foundation
import ImageIO
import UniformTypeIdentifiers
let args = CommandLine.arguments
let dir = URL(fileURLWithPath: args[1]), out = URL(fileURLWithPath: args[2]), quality = Double(args[3])!
let files = try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".png") }.sorted()
guard let dest = CGImageDestinationCreateWithURL(out as CFURL, UTType.heics.identifier as CFString, files.count, nil) else { fatalError("no HEICS encoder") }
CGImageDestinationSetProperties(dest, [kCGImagePropertyHEICSDictionary: [kCGImagePropertyHEICSLoopCount: 1]] as CFDictionary)
for f in files {
    let src = CGImageSourceCreateWithURL(dir.appendingPathComponent(f) as CFURL, nil)!
    let img = CGImageSourceCreateImageAtIndex(src, 0, nil)!
    CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: quality,
        kCGImagePropertyHEICSDictionary: [kCGImagePropertyHEICSDelayTime: 1.0 / 24.0]] as CFDictionary)
}
print(CGImageDestinationFinalize(dest) ? "ok" : "failed")
