/// Words for the device Wooli is running on, so copy reads right on iPhone and Mac.
enum ThisDevice {
    #if os(macOS)
    static let name = "Mac"
    static let biometry = "Touch ID"
    static let biometryIcon = "touchid"
    #else
    static let name = "iPhone"
    static let biometry = "Face ID"
    static let biometryIcon = "faceid"
    #endif
}
