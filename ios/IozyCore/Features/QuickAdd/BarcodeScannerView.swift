import SwiftUI
import VisionKit

/// Scanner de code-barres pour l'ajout rapide (parcours 1, étape 5 :
/// "moins de 5 secondes"). Utilise VisionKit plutôt qu'AVFoundation brut -
/// moins de code, et l'API supportée par Apple pour ce cas d'usage depuis
/// iOS 16.
///
/// Limite assumée : le code scanné est affiché tel quel et pré-remplit le
/// titre avec sa valeur brute - il n'y a pas encore de lookup vers une
/// base de métadonnées (ISBN → titre réel, etc.). Ce lookup est le rôle du
/// futur module "Metadata Enrichment" côté backend (Jikan/IGDB/BGG),
/// volontairement pas construit dans cet incrément.
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

/// Écran présenté en sheet depuis QuickAddView. Gère le cas simulateur
/// (pas de caméra disponible) avec un message explicite plutôt qu'un crash.
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
