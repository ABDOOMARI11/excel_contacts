# Contact Extractor

Application web en français pour extraire des noms et numéros depuis VCF, CSV, XLS/XLSX, PDF et DOCX, puis exporter les contacts en VCF, CSV, XLSX, PDF ou DOCX. Le traitement est effectué dans le navigateur.

## Prérequis
- Node.js 20 ou plus récent (npm est inclus avec Node.js)
- Connexion Internet pour charger les bibliothèques du navigateur via CDN

## Installation
Ouvrez un terminal dans le dossier du projet, puis lancez :

```bash
npm install
npm run dev
```

Vite affiche une adresse locale, généralement `http://localhost:5173`. Ouvrez-la dans votre navigateur.

## Vérifier la version de production
```bash
npm run build
npm run preview
```

## Déploiement sur Vercel
Importez le dossier dans un dépôt Git, puis importez ce dépôt dans Vercel. Vercel détecte Vite automatiquement. Commandes :
- Build command : `npm run build`
- Output directory : `dist`

Vous pouvez aussi installer la CLI Vercel et lancer `vercel` depuis ce dossier.

## Bibliothèques utilisées
Papa Parse (CSV), SheetJS (Excel), PDF.js (PDF), Mammoth (DOCX), Tesseract.js (OCR de secours pour PDF scannés), jsPDF (export PDF) et docx (export DOCX). Elles sont chargées depuis des CDN dans `index.html`, donc il n'est pas nécessaire de les installer avec npm. `npm install` installe Vite pour le serveur de développement et la compilation.

## Notes
- Les PDF scannés nécessitent davantage de temps et le téléchargement des données OCR.
- L'OCR peut faire des erreurs : vérifiez les noms et numéros avant export.
- WhatsApp exige un numéro international sans `+` dans le lien `wa.me`. Pour un numéro local marocain, ajoutez l'indicatif `+212` et retirez le zéro initial.
- L'application ne transmet pas de messages WhatsApp automatiquement.

## Lecture et conversion VCF
Vous pouvez importer un fichier `.vcf` pour lire ses fiches contact dans le tableau, modifier les noms/numéros, puis exporter les contacts en VCF, CSV, XLSX, PDF ou DOCX. Les bibliothèques d'export PDF/DOCX sont chargées depuis des CDN : une connexion Internet est nécessaire.
