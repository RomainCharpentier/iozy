import SwiftUI
import VisionKit

/// Barcode scanner for quick add (journey 1, step 5:
/// "less than 5 seconds"). Uses VisionKit rather than raw AVFoundation -
/// less code, and the API supported by Apple for this use case since
/// iOS 16.
///
/// Accepted limit: the scanned code is shown as is and pre-fills the
/// title with its raw value - there is no lookup yet to a
/// metadata base (ISBN → real title, etc.). This lookup is the role of the
/// future "Metadata Enrichment" module on the backend side (Jikan/IGDB/BGG),
/// deliberately not built in this increment.
struct BarcodeScannerView: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128])],
            qualityLevel: .fast,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: false,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {
        try? uiViewController.startScanning()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onScan: onScan)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void

        init(onScan: @escaping (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard case let .barcode(barcode) = addedItems.first, let payload = barcode.payloadStringValue else { return }
            onScan(payload)
        }
    }
}

/// Screen shown as a sheet from QuickAddView. Handles the simulator case
/// (no camera available) with an explicit message rather than a crash.
struct BarcodeScannerSheet: View {
    let onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    BarcodeScannerView { code in
                        onScan(code)
                        dismiss()
                    }
                    .ignoresSafeArea()
                } else {
                    ContentUnavailableView(
                        "Scanner indisponible",
                        systemImage: "camera.metering.unknown",
                        description: Text("Le scan de code-barres nécessite un appareil physique avec caméra (non disponible sur le simulateur).")
                    )
                }
            }
            .navigationTitle("Scanner")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}
