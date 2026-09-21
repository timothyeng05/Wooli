import SwiftUI

struct RootView: View {
    @State private var isConnected = SyncService.isConnected

    var body: some View {
        if isConnected {
            AccountsView(onDisconnect: {
                SyncService.disconnect()
                isConnected = false
            })
        } else {
            ConnectView(onConnected: { isConnected = true })
        }
    }
}
