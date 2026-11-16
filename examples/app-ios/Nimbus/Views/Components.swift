import SwiftUI

/// A scrolling screen with a title, used by all three tabs so none of them needs a
/// `NavigationView`.
struct Screen<Content: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.largeTitle.bold())
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
    }
}

/// A grouped block of content.
struct Card<Content: View>: View {
    var title: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let title {
                Text(title)
                    .font(.headline)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(14)
    }
}

/// A `label: value` line.
struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .foregroundColor(.secondary)
            Spacer(minLength: 12)
            Text(value)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}

/// The message strip above the tab bar.
struct NoticeBar: View {
    let notice: AppModel.Notice
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: iconName)
            Text(notice.text)
                .font(.footnote)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.15))
        .foregroundColor(tint)
    }

    private var iconName: String {
        switch notice.kind {
        case .info: return "info.circle"
        case .success: return "checkmark.circle"
        case .failure: return "exclamationmark.triangle"
        }
    }

    private var tint: Color {
        switch notice.kind {
        case .info: return .accentColor
        case .success: return .green
        case .failure: return .red
        }
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Talking to Voidhash…")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
    }
}

/// What the app shows when the SDK's first round-trip fails.
struct FailureView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("Nimbus could not start")
                .font(.headline)
            Text(message)
                .font(.footnote)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button("Try again", action: onRetry)
                .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }
}

/// Shown instead of the app when `VOIDHASH_PUBLISHABLE_KEY` is still empty.
struct MissingKeyView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("No publishable key")
                .font(.title2.bold())
            Text(
                "Copy Config/Secrets.xcconfig.example to Config/Secrets.xcconfig, paste the "
                    + "publishable key of your project (Studio → Project settings → API keys) "
                    + "and run again."
            )
            .font(.subheadline)
            .foregroundColor(.secondary)
            Text("VOIDHASH_PUBLISHABLE_KEY = vh_pk_…")
                .font(.system(.footnote, design: .monospaced))
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(10)
        }
        .padding(32)
    }
}
