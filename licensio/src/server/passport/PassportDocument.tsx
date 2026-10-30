import { Document, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ComplianceStatus, FindingSeverity } from "@prisma/client";
import { ASSET_TYPE_LABELS, dateFormat, dayFormat, LICENSE_TYPE_LABELS, PROJECT_USAGE_LABELS } from "@/lib/labels";
import { PASSPORT_VERDICT, type Passport } from "./data";

// Polices PDF standard (Helvetica) : accents français couverts, pas de téléchargement.
// Les pictogrammes sont dessinés en SVG, Helvetica n'ayant pas de ✓.

const COLORS: Record<ComplianceStatus, { main: string; soft: string }> = {
  COMPLIANT: { main: "#15803d", soft: "#f0fdf4" },
  WARNING: { main: "#b45309", soft: "#fffbeb" },
  NON_COMPLIANT: { main: "#b91c1c", soft: "#fef2f2" },
  PENDING: { main: "#525252", soft: "#f5f5f5" },
};

const ROW: Record<FindingSeverity, { label: string; color: string }> = {
  OK: { label: "Valide", color: "#15803d" },
  WARNING: { label: "Avec réserve", color: "#b45309" },
  ERROR: { label: "Non couverte", color: "#b91c1c" },
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 110, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9, color: "#171717" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 1 },
  kicker: { marginTop: 18, fontSize: 8, letterSpacing: 2, color: "#a3a3a3", fontFamily: "Helvetica-Bold" },
  title: { marginTop: 4, fontSize: 20, fontFamily: "Helvetica-Bold" },
  verdict: { marginTop: 16, flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 8 },
  verdictTitle: { fontFamily: "Helvetica-Bold", fontSize: 15, letterSpacing: 0.8, textTransform: "uppercase" },
  verdictText: { marginTop: 3, fontSize: 9, color: "#404040", maxWidth: 400 },
  facts: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", borderTop: "1 solid #e5e5e5", borderBottom: "1 solid #e5e5e5", paddingVertical: 10 },
  fact: { width: "33.33%", paddingVertical: 5, paddingRight: 8 },
  factLabel: { fontSize: 7, color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 0.6 },
  factValue: { marginTop: 2, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 18, marginBottom: 6, fontSize: 8, letterSpacing: 1, color: "#737373", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  th: { flexDirection: "row", backgroundColor: "#f5f5f5", paddingVertical: 5, paddingHorizontal: 6, fontSize: 7, color: "#737373", fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, borderBottom: "1 solid #f0f0f0" },
  cName: { width: "34%", paddingRight: 6 },
  cLicense: { width: "16%", paddingRight: 6 },
  cKey: { width: "20%", paddingRight: 6 },
  cValid: { width: "17%", paddingRight: 6 },
  cStatus: { width: "13%" },
  muted: { color: "#737373", fontSize: 8 },
  mono: { fontFamily: "Courier", fontSize: 8.5 },
  note: { marginTop: 3, fontSize: 7.5 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 30, flexDirection: "row", borderTop: "1 solid #e5e5e5", paddingTop: 10 },
  qr: { width: 58, height: 58, marginRight: 12 },
  // Pas de lineHeight dans le pied de page : hérité par le texte dynamique (numéro de
  // page), il fait disparaître tout le bloc (bug de react-pdf 4.9).
  footText: { flex: 1, fontSize: 7, color: "#737373" },
  footLine: { marginBottom: 1.5 },
});

function Seal({ status }: { status: ComplianceStatus }) {
  const color = COLORS[status].main;
  const mark =
    status === "COMPLIANT" ? "M7.5 12.5l3 3 6-6.5" : status === "NON_COMPLIANT" ? "M9 9l6 6m0-6l-6 6" : "M12 7.5v5.5m0 3v.5";
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 40, height: 40, marginRight: 12 }}>
      <Path d="M12 2.8l7.5 3v5.6c0 4.6-3.1 8.6-7.5 9.8-4.4-1.2-7.5-5.2-7.5-9.8V5.8z" fill={color} />
      <Path d={mark} stroke="#ffffff" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PassportDocument({ passport: p, qrDataUrl, generatedAt }: { passport: Passport; qrDataUrl: string; generatedAt: Date }) {
  const verdict = PASSPORT_VERDICT[p.status];
  const color = COLORS[p.status];
  const facts = [
    ["Client", p.clientName ?? "—"],
    ["Émis par", p.issuer],
    ["Usage couvert", PROJECT_USAGE_LABELS[p.usage]],
    ["Diffusion", p.publishedAt ? dayFormat.format(p.publishedAt) : "Non renseignée"],
    [
      "Vérifié le",
      p.verifiedAt
        ? `${dateFormat.format(p.verifiedAt)} à ${p.verifiedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}`
        : "—",
    ],
    ["N° de vérification", p.verificationId ?? "—"],
  ];

  return (
    <Document title={`Passeport de Droits — ${p.projectName}`} author={p.issuer} creator="Licensio" producer="Licensio" language="fr">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>LICENSIO</Text>
        <Text style={s.kicker}>PASSEPORT DE DROITS</Text>
        <Text style={s.title}>{p.projectName}</Text>

        <View style={[s.verdict, { backgroundColor: color.soft, border: `1 solid ${color.main}` }]}>
          <Seal status={p.status} />
          <View>
            <Text style={[s.verdictTitle, { color: color.main }]}>{verdict.title}</Text>
            <Text style={s.verdictText}>{verdict.subtitle}</Text>
          </View>
        </View>

        <View style={s.facts}>
          {facts.map(([label, value]) => (
            <View key={label} style={s.fact}>
              <Text style={s.factLabel}>{label}</Text>
              <Text style={s.factValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Ressources utilisées ({p.assets.length})</Text>
        <View style={s.th} fixed>
          <Text style={s.cName}>Ressource</Text>
          <Text style={s.cLicense}>Licence</Text>
          <Text style={s.cKey}>Identifiant</Text>
          <Text style={s.cValid}>Validité</Text>
          <Text style={s.cStatus}>Statut</Text>
        </View>
        {p.assets.length === 0 && <Text style={[s.muted, { padding: 6 }]}>Aucune ressource déclarée.</Text>}
        {p.assets.map((a, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={s.cName}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{a.name}</Text>
              <Text style={s.muted}>{[a.author, ASSET_TYPE_LABELS[a.assetType], a.platform].filter(Boolean).join(" · ")}</Text>
              {a.notes.map((n) => (
                <Text key={n} style={[s.note, { color: ROW[a.severity].color }]}>
                  {n}
                </Text>
              ))}
            </View>
            <Text style={s.cLicense}>{a.licenseType ? LICENSE_TYPE_LABELS[a.licenseType] : "—"}</Text>
            <Text style={[s.cKey, s.mono]}>{a.licenseType ? (a.licenseKey ?? "non renseigné") : "—"}</Text>
            <View style={s.cValid}>
              {a.purchaseDate && <Text>Depuis le {dayFormat.format(a.purchaseDate)}</Text>}
              {a.licenseType && <Text style={s.muted}>{a.expiresAt ? `Jusqu'au ${dayFormat.format(a.expiresAt)}` : "Sans expiration"}</Text>}
            </View>
            <Text style={[s.cStatus, { color: ROW[a.severity].color, fontFamily: "Helvetica-Bold" }]}>{ROW[a.severity].label}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, pas une balise img */}
          <Image src={qrDataUrl} style={s.qr} />
          <View style={s.footText}>
            <Text style={[s.footLine, { color: "#171717", fontFamily: "Helvetica-Bold" }]}>Version en ligne, mise à jour en continu : scannez le code.</Text>
            <Text style={s.footLine}>{p.url}</Text>
            <Text style={[s.footLine, { marginTop: 4 }]}>
              Ce passeport recoupe les ressources déclarées par {p.issuer} avec les licences et preuves d&apos;achat enregistrées dans
              son coffre-fort Licensio, à la date de vérification. Il ne remplace pas les conditions de licence des plateformes, qui font foi.
            </Text>
            <Text
              style={{ marginTop: 4 }}
              render={({ pageNumber, totalPages }) => `Document généré le ${dateFormat.format(generatedAt)} · Page ${pageNumber} / ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
