# Dorabella Cipher Investigation

## 🔍 Overview

This repository hosts my investigation of the **Dorabella cipher** — the note of 87 glyphs that Edward Elgar sent to Dora Penny on 14 July 1897, unsolved to this day. The write-up is served via **GitHub Pages** at [https://bugfishtm.github.io/cipher-dorabella](https://bugfishtm.github.io/cipher-dorabella). It covers what I read about the note, Elgar, his other ciphers and every published attempt, and what I did myself: my own transcription, the snowflake-key idea, the measurements, the long-running server hunt, and what is left to try. A separate page lists every attempt with an honest verdict on whether it was worth the time.

The site also carries my browser toolkit (`docs/toolkit/`): a seven-phase decipher tool with a calibrated annealing solver and key hunt, a transposition bench, string experiments and an encipher tool. All of them run on the same polar-key engine, which is covered by 4,049 test assertions. The site also documents the Python lab and the 108-million-candidate server hunt behind the other numbers it quotes. The short version: a regular rotating key is ruled out (p = 0.0003), a plain substitution of English is ruled out (z = −7.5 to −9.6 at matched effort), and the note is still unread.

**Please note:** This is a private project. The source code is public only because it is part of my project infrastructure — GitHub Pages requires the repository content to be accessible. This is not an open-source project, not a template, and not intended for reuse.

## 📁 Repository Structure

This table provides an overview of the key files and folders of the project.

|Path|Description|
|----|-----|
| docs/ | The investigation website, served via GitHub Pages. |
| docs/index.html | Home page — case status, the argument in six lines, section overview. |
| docs/01-note.html … 04-record.html | Background, what I read — the note, Edward Elgar, his other ciphers, the published record. |
| docs/05-transcription.html … 11-next.html | Investigation, what I did — my transcription, the snowflake key, measurements, what I tried, the long hunt, what cipher it is, what to do next. |
| docs/08-attempts.html | Every attempt in the order I made it, with a verdict: worth it, dead end, lesson, open, or deliberately not done. |
| docs/12-sources.html | Everything I read, the image gallery with licences, and my own working images. |
| docs/13-workbench.html | Workbench — encipher, decipher and crib-test in the browser. |
| docs/toolkit/ | The interactive toolkit, built from my sources: decipher, transpose, experiments, encipher — plus the archived first versions (`snowflake-v1.html`, `workbench-v1.html`). |
| docs/assets/ | Stylesheet, scripts, the cipher engine, the transcription data and all images — everything served locally. |
| [LICENSE.md](LICENSE.md) | License of this project. |

## 👀 Looking Around

You are welcome to browse the code, read the investigation and try the tools. However:

- **All rights are reserved.** No permission is granted to copy, reuse, modify or redistribute any part of this repository — code, design, texts or data — unless explicitly stated otherwise in [LICENSE.md](LICENSE.md).
- Third-party images keep their own licences. The Wikimedia Commons files are CC BY 3.0 or CC BY-SA 4.0, and Elgar's own documents are in the public domain. Each one is credited on the sources page (`docs/12-sources.html`).
- This repository does not accept feature requests, and contributions are generally not expected — it exists to document my own work on the cipher.

## 📜 License Information

The license for this project can be found in the [LICENSE.md](LICENSE.md) file. The repository may also include additional licensed software or libraries.

🐟 Bugfish
