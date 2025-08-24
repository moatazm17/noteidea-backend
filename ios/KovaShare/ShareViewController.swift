import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Set up the premium glassmorphism UI
        setupPremiumUI()
        
        // Extract the shared content
        extractSharedContent()
    }
    
    private func setupPremiumUI() {
        // Create glassmorphism background
        let blurEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(blurView)
        
        // Create container with rounded corners
        let container = UIView()
        container.backgroundColor = UIColor.white.withAlphaComponent(0.9)
        container.layer.cornerRadius = 24
        container.layer.masksToBounds = true
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)
        
        // Add Kova branding
        let titleLabel = UILabel()
        titleLabel.text = "Save to Kova"
        titleLabel.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        titleLabel.textColor = .black
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(titleLabel)
        
        // Add subtitle
        let subtitleLabel = UILabel()
        subtitleLabel.text = "AI will analyze and organize this content"
        subtitleLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        subtitleLabel.textColor = .gray
        subtitleLabel.textAlignment = .center
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(subtitleLabel)
        
        // Add save button
        let saveButton = UIButton(type: .system)
        saveButton.setTitle("🎉 Save Content", for: .normal)
        saveButton.titleLabel?.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        saveButton.backgroundColor = UIColor.systemBlue
        saveButton.setTitleColor(.white, for: .normal)
        saveButton.layer.cornerRadius = 16
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        saveButton.addTarget(self, action: #selector(saveContent), for: .touchUpInside)
        container.addSubview(saveButton)
        
        // Add cancel button
        let cancelButton = UIButton(type: .system)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        cancelButton.setTitleColor(.gray, for: .normal)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.addTarget(self, action: #selector(cancelShare), for: .touchUpInside)
        container.addSubview(cancelButton)
        
        // Set up constraints
        NSLayoutConstraint.activate([
            // Blur background
            blurView.topAnchor.constraint(equalTo: view.topAnchor),
            blurView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            blurView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            // Container
            container.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            container.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
            container.heightAnchor.constraint(equalToConstant: 280),
            
            // Title
            titleLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 32),
            titleLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            titleLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),
            
            // Subtitle
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            subtitleLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            subtitleLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),
            
            // Save button
            saveButton.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 40),
            saveButton.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 24),
            saveButton.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -24),
            saveButton.heightAnchor.constraint(equalToConstant: 56),
            
            // Cancel button
            cancelButton.topAnchor.constraint(equalTo: saveButton.bottomAnchor, constant: 16),
            cancelButton.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            cancelButton.heightAnchor.constraint(equalToConstant: 44)
        ])
    }
    
    private func extractSharedContent() {
        guard let extensionContext = extensionContext else { return }
        
        for item in extensionContext.inputItems {
            guard let inputItem = item as? NSExtensionItem else { continue }
            guard let attachments = inputItem.attachments else { continue }
            
            for attachment in attachments {
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                        if let url = item as? URL {
                            DispatchQueue.main.async {
                                self?.handleSharedURL(url.absoluteString)
                            }
                        }
                    }
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                        if let text = item as? String {
                            DispatchQueue.main.async {
                                self?.handleSharedURL(text)
                            }
                        }
                    }
                }
            }
        }
    }
    
    private var sharedURL: String?
    
    private func handleSharedURL(_ url: String) {
        self.sharedURL = url
        print("📱 Extracted URL: \(url)")
    }
    
    @objc private func saveContent() {
        guard let url = sharedURL else {
            showError("No content to save")
            return
        }
        
        // Show loading state
        showLoading()
        
        // Save to Kova backend
        saveToKova(url: url) { [weak self] success in
            DispatchQueue.main.async {
                if success {
                    self?.showSuccess()
                } else {
                    self?.showError("Failed to save content")
                }
            }
        }
    }
    
    private func saveToKova(url: String, completion: @escaping (Bool) -> Void) {
        // Create the request
        guard let apiURL = URL(string: "https://noteidea-backend-production.up.railway.app/api/content/save") else {
            completion(false)
            return
        }
        
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "deviceId": "device_share_extension",
            "url": url,
            "contentType": "other"
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(false)
            return
        }
        
        // Make the request
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("❌ Save error: \(error)")
                completion(false)
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                print("✅ Content saved successfully")
                completion(true)
            } else {
                completion(false)
            }
        }.resume()
    }
    
    private func showLoading() {
        // Update UI to show loading
        print("🔄 Saving content...")
    }
    
    private func showSuccess() {
        // Show success and auto-dismiss
        print("✅ Content saved!")
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    private func showError(_ message: String) {
        print("❌ Error: \(message)")
        
        let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            self.cancelShare()
        })
        present(alert, animated: true)
    }
    
    @objc private func cancelShare() {
        extensionContext?.cancelRequest(withError: NSError(domain: "UserCancelled", code: 0, userInfo: nil))
    }
}