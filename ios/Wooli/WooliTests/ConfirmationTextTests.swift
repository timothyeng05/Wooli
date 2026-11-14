import Foundation
import Testing
@testable import Wooli

// Text out of dropped .eml and .txt confirmations (ConfirmationText).

struct ConfirmationTextTests {
    @Test func plainMessageKeepsSubjectAndBody() {
        let eml = "From: a@b.c\r\nSubject: Your flight CX831\r\n\r\nBooking reference: ABC123\r\nCX831 JFK HKG\r\n"
        let out = ConfirmationText.fromEML(eml)
        #expect(out.hasPrefix("Your flight CX831"))
        #expect(out.contains("Booking reference: ABC123"))
    }

    @Test func foldedSubjectIsJoined() {
        let eml = "Subject: Your stay at\n Hyatt Regency Hangzhou\n\nbody"
        #expect(ConfirmationText.fromEML(eml).hasPrefix("Your stay at Hyatt Regency Hangzhou"))
    }

    @Test func multipartPrefersPlainTextAndDecodesQuotedPrintable() {
        let eml = """
        Subject: Hotel
        Content-Type: multipart/alternative; boundary="XYZ"

        --XYZ
        Content-Type: text/html; charset=utf-8

        <p>HTML version</p>
        --XYZ
        Content-Type: text/plain; charset=utf-8
        Content-Transfer-Encoding: quoted-printable

        Check-in: Apr 2, 2027=0ACaf=C3=A9 Rooms=
         Ltd
        --XYZ--
        """
        let out = ConfirmationText.fromEML(eml)
        #expect(out.contains("Check-in: Apr 2, 2027"))
        #expect(out.contains("Café Rooms Ltd"))
        #expect(!out.contains("HTML version"))
    }

    @Test func htmlOnlyIsStrippedToLines() {
        let eml = "Content-Type: text/html\n\n<html><body><p>Total: <b>USD 640</b></p><p>Check&nbsp;in: Apr 2</p></body></html>"
        let out = ConfirmationText.fromEML(eml)
        #expect(out.contains("Total:"))
        #expect(out.contains("USD 640"))
        #expect(out.contains("Check in: Apr 2"))
        #expect(!out.contains("<"))
    }

    @Test func base64BodyIsDecoded() {
        let encoded = Data("CX831 JFK HKG".utf8).base64EncodedString()
        let eml = "Content-Type: text/plain\nContent-Transfer-Encoding: base64\n\n\(encoded)\n"
        #expect(ConfirmationText.fromEML(eml).contains("CX831 JFK HKG"))
    }

    @Test func txtFilesComeThroughAsTheyAre() {
        #expect(ConfirmationText.text(fromFile: "trip.txt", data: Data("hello".utf8)) == "hello")
    }
}
