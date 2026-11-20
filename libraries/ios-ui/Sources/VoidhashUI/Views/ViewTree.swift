#if os(iOS)
    import QuartzCore
    import UIKit

    /// The host's view tree, changed only by view operations (views protocol, "Operation
    /// batches"). The root, id 0, is the host's container and is never created or deleted.
    @MainActor
    final class ViewTree {
        /// What one batch did that the host acts on after applying it.
        struct Changes {
            /// `screen` views created after the package's first batch: they enter.
            var enteredScreens: [NodeView] = []
            /// `screen` views whose `closing` became true: they leave.
            var closingScreens: [NodeView] = []
            /// `screen` views deleted by the batch (not by a reset).
            var deletedScreens: [NodeView] = []
            /// Operations that broke the protocol's rules, skipped.
            var issues: [String] = []
            /// The batch reset the tree.
            var reset = false
        }

        let root: NodeView
        private(set) var nodes: [Int32: NodeView] = [:]
        private weak var host: NodeHost?
        /// The package's first batch is applied; screens created later enter.
        private var showsPackage = false
        private var liveRegions: Set<Int32> = []
        /// Views with `layerBlur`, whose snapshots are renewed after every batch.
        private var blurred: Set<Int32> = []
        private var screenIds: Set<Int32> = []
        /// The field of the latest `TEXT_FOCUS` while it waits for its window.
        private weak var focusRequest: TextInputNodeView?

        init(host: NodeHost) {
            self.host = host
            root = NodeView(id: 0, kind: .view, host: host)
        }

        /// The view of `id`, the root for 0.
        func node(_ id: Int32) -> NodeView? {
            return id == 0 ? root : nodes[id]
        }

        /// Applies a batch in order, then the changed props and frames, without implicit
        /// animations.
        func apply(_ operations: [ViewOperation]) -> Changes {
            var changes = Changes()
            var dirty: [Int32: NodeView] = [:]
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            defer { CATransaction.commit() }
            for operation in operations {
                switch operation {
                case .reset:
                    for node in nodes.values {
                        node.removeFromSuperview()
                        node.released()
                    }
                    nodes.removeAll()
                    dirty.removeAll()
                    liveRegions.removeAll()
                    blurred.removeAll()
                    screenIds.removeAll()
                    root.setChildren([])
                    focusRequest = nil
                    showsPackage = false
                    changes.reset = true
                case .create(let id, let kind):
                    guard id != 0 else {
                        changes.issues.append("the root was created")
                        continue
                    }
                    if let existing = nodes[id] {
                        changes.issues.append("view \(id) was created twice")
                        existing.detachFromParent()
                        existing.released()
                    }
                    let node = Self.make(id: id, kind: kind, host: host)
                    nodes[id] = node
                    dirty[id] = node
                    liveRegions.remove(id)
                    blurred.remove(id)
                    if node.kind == .screen {
                        screenIds.insert(id)
                        if showsPackage {
                            changes.enteredScreens.append(node)
                        }
                    } else {
                        screenIds.remove(id)
                    }
                case .props(let id, let props):
                    guard let node = node(id) else {
                        changes.issues.append("props for unknown view \(id)")
                        continue
                    }
                    let wasClosing = node.props["closing"]?.bool == true
                    node.merge(props)
                    if node.kind == .screen, !wasClosing, node.props["closing"]?.bool == true {
                        changes.closingScreens.append(node)
                    }
                    if node.props["layerBlur"] != nil {
                        blurred.insert(id)
                    } else {
                        blurred.remove(id)
                    }
                    if node.props["accessibilityLiveRegion"]?.string != nil {
                        liveRegions.insert(id)
                    } else {
                        liveRegions.remove(id)
                    }
                    dirty[id] = node
                case .frame(let id, let frame):
                    guard let node = node(id) else {
                        changes.issues.append("frame for unknown view \(id)")
                        continue
                    }
                    node.place(frame.rect)
                    dirty[id] = node
                case .children(let id, let ids):
                    guard let parent = node(id) else {
                        changes.issues.append("children for unknown view \(id)")
                        continue
                    }
                    var children: [NodeView] = []
                    for childId in ids {
                        guard childId != 0, let child = nodes[childId] else {
                            changes.issues.append("unknown subview \(childId) of \(id)")
                            continue
                        }
                        children.append(child)
                    }
                    parent.setChildren(children)
                case .delete(let id):
                    guard id != 0, let node = nodes.removeValue(forKey: id) else {
                        changes.issues.append("deleted unknown view \(id)")
                        continue
                    }
                    node.detachFromParent()
                    node.released()
                    dirty[id] = nil
                    liveRegions.remove(id)
                    blurred.remove(id)
                    if screenIds.remove(id) != nil {
                        changes.deletedScreens.append(node)
                    }
                    if node === focusRequest {
                        focusRequest = nil
                    }
                case .canvas(let id, let images, let drawList):
                    guard let canvas = nodes[id] as? ExternalNodeView else {
                        changes.issues.append("canvas for view \(id), which is not a canvas")
                        continue
                    }
                    canvas.show(drawList: drawList, images: images)
                case .textFocus(let id):
                    guard let field = nodes[id] as? TextInputNodeView else {
                        changes.issues.append("text focus for view \(id), which is not a text input")
                        continue
                    }
                    // Its props, the keyboard set-up among them, before it takes the keyboard.
                    dirty.removeValue(forKey: id)?.refresh()
                    if focusRequest !== field {
                        focusRequest?.cancelFocusRequest()
                    }
                    focusRequest = field
                    field.focus()
                case .textBlur(let id):
                    guard let field = nodes[id] as? TextInputNodeView else {
                        changes.issues.append("text blur for view \(id), which is not a text input")
                        continue
                    }
                    if focusRequest === field {
                        focusRequest = nil
                    }
                    field.blur()
                case .textSet(let set):
                    guard let field = nodes[set.id] as? TextInputNodeView else {
                        // Never the text: it is the end user's.
                        changes.issues.append(
                            "text set for view \(set.id), which is not a text input")
                        continue
                    }
                    // Styled as its props say before the text arrives.
                    dirty.removeValue(forKey: set.id)?.refresh()
                    field.apply(set)
                }
            }
            for node in dirty.values {
                node.refresh()
            }
            renderBlurs()
            showsPackage = true
            announceLiveRegions()
            return changes
        }

        /// Releases every view, as the host goes away.
        func release() {
            for node in nodes.values {
                node.released()
            }
            nodes.removeAll()
        }

        /// Every `screen` view, in no particular order.
        var screens: [NodeView] {
            return screenIds.compactMap { nodes[$0] }
        }

        /// Shows a loaded image in every view that names it.
        func imageLoaded(_ url: String) {
            for node in nodes.values {
                node.imageLoaded(url)
            }
            renderBlurs()
        }

        private func renderBlurs() {
            for id in blurred {
                nodes[id]?.renderLayerBlur()
            }
        }

        /// Places the root over the host's bounds.
        func layoutRoot(in bounds: CGRect) {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            root.place(bounds)
            root.refresh()
            CATransaction.commit()
        }

        /// Announces what a live region reads when it changed, politely queued or at once.
        private func announceLiveRegions() {
            for id in liveRegions {
                guard let node = nodes[id] else {
                    continue
                }
                let text = node.spokenText ?? ""
                defer { node.spokenLiveText = text }
                guard let previous = node.spokenLiveText, previous != text, !text.isEmpty,
                    !node.isHidden
                else {
                    continue
                }
                let polite = node.props["accessibilityLiveRegion"]?.string != "assertive"
                UIAccessibility.post(
                    notification: .announcement,
                    argument: NSAttributedString(
                        string: text, attributes: [.accessibilitySpeechQueueAnnouncement: polite]))
            }
        }

        private static func make(id: Int32, kind: UInt8, host: NodeHost?) -> NodeView {
            // A kind this host does not know shows a plain view.
            let kind = NodeKind(rawValue: kind) ?? .view
            switch kind {
            case .text:
                return TextNodeView(id: id, kind: kind, host: host)
            case .textInput:
                return TextInputNodeView(id: id, kind: kind, host: host)
            case .image:
                return ImageNodeView(id: id, kind: kind, host: host)
            case .path:
                return PathNodeView(id: id, kind: kind, host: host)
            case .scrollView:
                return ScrollNodeView(id: id, kind: kind, host: host)
            case .external:
                return ExternalNodeView(id: id, kind: kind, host: host)
            case .view, .pressable, .safeArea, .stack, .screen:
                return NodeView(id: id, kind: kind, host: host)
            }
        }
    }
#endif
