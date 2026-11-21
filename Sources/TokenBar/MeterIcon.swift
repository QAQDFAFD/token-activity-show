import AppKit

enum MeterIcon {
    static func makeImage(percents: [Double]) -> NSImage {
        let size = NSSize(width: 18, height: 14)
        let image = NSImage(size: size, flipped: false) { rect in
            let values = Array(percents.prefix(3))
            let barWidth: CGFloat = 3.6
            let gap: CGFloat = 2.2

            if values.isEmpty {
                let path = NSBezierPath(roundedRect: NSRect(
                    x: 3,
                    y: rect.midY - 1,
                    width: rect.width - 6,
                    height: 2), xRadius: 1, yRadius: 1)
                NSColor.black.setFill()
                path.fill()
                return true
            }

            let totalWidth = CGFloat(values.count) * barWidth + CGFloat(values.count - 1) * gap
            var x = (rect.width - totalWidth) / 2
            let baseline = rect.minY + 1.2
            let maxHeight = rect.height - 2.4

            for value in values {
                let clamped = min(100, max(0, value))
                let height = max(2.2, maxHeight * CGFloat(clamped / 100))
                let path = NSBezierPath(
                    roundedRect: NSRect(x: x, y: baseline, width: barWidth, height: height),
                    xRadius: 1.2,
                    yRadius: 1.2)
                NSColor.black.setFill()
                path.fill()
                x += barWidth + gap
            }
            return true
        }
        image.isTemplate = true
        return image
    }
}
