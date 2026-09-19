import Foundation
import Speech
import AVFoundation

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: transcribe <audio> <out.txt> [locale]"); exit(1) }
let url = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let locale = Locale(identifier: args.count > 3 ? args[3] : "zh-TW")

let transcriber = SpeechTranscriber(locale: locale,
                                    transcriptionOptions: [],
                                    reportingOptions: [],
                                    attributeOptions: [.audioTimeRange])
let analyzer = SpeechAnalyzer(modules: [transcriber])
let audioFile = try AVAudioFile(forReading: url)

let collector = Task { () -> [String] in
    var out: [String] = []
    for try await result in transcriber.results {
        let text = String(result.text.characters)
        let s = result.range.start.seconds
        let mm = Int(s) / 60, ss = Int(s) % 60
        out.append(String(format: "[%02d:%02d] %@", mm, ss, text))
    }
    return out
}

if let last = try await analyzer.analyzeSequence(from: audioFile) {
    try await analyzer.finalizeAndFinish(through: last)
} else {
    await analyzer.cancelAndFinishNow()
}
let lines = try await collector.value
try lines.joined(separator: "\n").write(to: outURL, atomically: true, encoding: .utf8)
print("segments:", lines.count)
