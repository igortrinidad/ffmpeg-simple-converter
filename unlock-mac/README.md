# mediacript-unlock-mac

Depois de baixar o instalador do Mediacript para macOS (`.dmg`) pelo GitHub Releases, o macOS
coloca o app em quarentena por não ser assinado/notarizado — ao tentar abrir, aparece
"Mediacript está danificado e não pode ser aberto" ou similar.

Este comando resolve isso automaticamente:

```bash
npx mediacript-unlock-mac
```

O que ele faz:

1. Procura o `Mediacript*.dmg` mais recente em `~/Downloads`
2. Monta o DMG
3. Instala (ou substitui) o app em `/Applications`
4. Ejeta o DMG
5. Remove a quarentena do Gatekeeper (`xattr -cr`)
6. Abre o Mediacript

Só funciona no macOS.
