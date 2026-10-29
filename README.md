# Lang Tags BD

Aplicação web local para consultar exemplos de HTML, CSS, JavaScript e outras linguagens.

## Executar

Como o navegador não permite que JavaScript leia pastas locais diretamente, sirva esta pasta por um servidor HTTP local. Por exemplo, com Python instalado, execute na raiz do projeto:

```sh
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador.

## Publicar no GitHub Pages

O projeto é estático e pode ser publicado diretamente pelo GitHub Actions. Depois de enviar este repositório ao GitHub, abra **Settings → Pages** e selecione **GitHub Actions** como origem. A cada envio para `main`, o site será atualizado. O endereço será `https://<usuario>.github.io/<repositorio>/`.

O conteúdo em `database/` também fica público junto com o site.

## Instalar como aplicativo (PWA)

Depois que o site estiver publicado no GitHub Pages, abra o endereço HTTPS no Brave. Use o ícone de instalação na barra de endereço ou o menu **⋮ → Salvar e compartilhar → Instalar página como aplicativo**.

O aplicativo inclui manifesto, ícones e cache offline. A instalação não funciona abrindo `index.html` diretamente com `file://`; é necessário acessar por HTTPS ou por `http://localhost`.

## Adicionar conteúdo

Crie um arquivo JSON dentro da pasta da linguagem e registre o nome do arquivo em `database/manifest.json`. Cada item pode ter `title`, `description`, `tags` e `code`. A pesquisa procura primeiro no título/nome do arquivo e, sem correspondência, nas etiquetas e descrição.
