import SwiftUI
import UIKit

/// Entry point: refuses to configure the SDK until a publishable key is in place.
struct RootView: View {
    var body: some View {
        if let publishableKey = NimbusConfiguration.publishableKey {
            ConfiguredRootView(publishableKey: publishableKey)
        } else {
            MissingKeyView()
        }
    }
}

private struct ConfiguredRootView: View {
    @StateObject private var model: AppModel

    init(publishableKey: String) {
        _model = StateObject(wrappedValue: AppModel(publishableKey: publishableKey))
    }

    var body: some View {
        content
            .environmentObject(model)
            .task { await model.load() }
            // Analytics are batched; flushing on the way out keeps the last few events from
            // waiting for the next launch.
            .onReceive(
                NotificationCenter.default.publisher(
                    for: UIApplication.didEnterBackgroundNotification)
            ) { _ in
                Task { await model.flushAnalytics() }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            LoadingView()
        case .failed(let message):
            FailureView(message: message) {
                Task { await model.load() }
            }
        case .ready:
            MainTabView()
        }
    }
}

private struct MainTabView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        VStack(spacing: 0) {
            if let notice = model.notice {
                NoticeBar(notice: notice) { model.dismissNotice() }
            }
            TabView(selection: $model.selectedTab) {
                NotesScreen()
                    .tabItem { Label("Notes", systemImage: "note.text") }
                    .tag(AppTab.notes)
                UpgradeScreen()
                    .tabItem { Label("Upgrade", systemImage: "sparkles") }
                    .tag(AppTab.upgrade)
                AccountScreen()
                    .tabItem { Label("Account", systemImage: "person.crop.circle") }
                    .tag(AppTab.account)
            }
        }
    }
}
