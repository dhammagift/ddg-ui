# Dict.Dhamma.Gift

A Pali dictionary by the Suttas and the Vinaya: a word means what the Suttas and the Vinaya themselves say it means — in their definitions and similes.

- **Definitions from the Suttas and the Vinaya.** For 800 key terms of the Dhamma.Gift glossary (702 defined there), the
  Pali definition word for word and every line in the Suttas and the Vinaya where it stands, with the Dhamma.Gift
  rendering in English and Russian; special definitions marked; found by inflected forms too.
- **Then, in the word page's default order:** DPD (Digital Pāḷi Dictionary); Sutta-Vinaya Definitions and Similes
  (definitions and similes from the Suttas and the Vinaya, for any word); the Gandhari Dictionary; PTS; Buddhadust; Wisdom Library; 30+ Sanskrit dictionaries.

Site: https://dict.dhamma.gift (also https://dhamma.gift/dict, offline). Apps: App Store, Google Play, Microsoft
Store. Built into Dhamma.Gift as the click-to-look-up dictionary. User guide:
https://dhamma.gift/docs/dictionary/

Pages: `public/templates/home.html` + `i18n/ru.json` -> `node build-pages.js` (EN, RU and the key-term pages).
Check that `i18n/ru.json` has every new template line before running it, or the RU pages fall back to English.

The interface began as a Dhamma.gift edition of the dpdict.net interface; the history below is from that time.

List of improvements:

UPD integrated numerous Sanskrit Dictionaries provided by https://www.sanskrit-lexicon.uni-koeln.de/ screenshot after the list of changes

1. OpenDict menu - with numerous dictionaries pali + sanskrit, Dharmamitra and few other resourses.
2. sortable table for grammar dict on the client side 
3. example links opened on Dhamma.gift with word from example highlighted and with autoscroll to the first match. added for mn dn sn an dhp snp ud  
4. type with autocomplete pali words in search bar
5. PWA lookup words from any apps using share from context menu, if app installed as PWA. (chrome mobile -> menu -> add to home screen)
6. PWA shortcuts (long press installed app icon on Home screen) for quick access to Dhamma.gift and Russian/English version of Dict.Dhamma.Gift
7. type / to bring up autofocus on search bar. also autofocus added on page load 
8. "clear" button added to search bar
9. transform history pane and settings pane into collapsible/expandable button on mobile breakpoints.
10. added extra links in the footer to open current search term on dhamma.gift sutta search and on dpdict.net
11. added spinner while waiting for results in site mode
12. auto replace links to DG hosted tbw on the client side
13. clickable logo and site name on main page desktop and talbet leading to / or /ru/ — acts like clear button.
14. disabled slow 1s transition of the dark/light theme for popup mode as it makes popup load look glitchy
15. added protection against repeated form submits
16. other improvements mostly on css side to make site mobile user friendly. Related to input sizes and saving extra space

UPD Sanskrit integration

<img width="1927" height="950" alt="Image" src="https://github.com/user-attachments/assets/01fdebcd-ed4d-49c8-8d74-530f7ce8d191" />



## installation 

1. clone this repo
2. cd into it
3. creat virtual environment and install dependencies and start
   
   ```
   python -m venv .venv
   .venv/bin/pip install -r requirements.tx
   # start with
   nohup ./start.sh &
   ```
   
4. to stop use
   ```
   ./stop.sh
   ```
   
## Details

technically it is a modified dpd-db repo where dpdict.net is used as backend instead of direct calls to dpd-db.

Following files added to original exporter/webapp/static

├── extrastyles.css
├── jquery-ui.css
├── jquery-ui.min.css


├── openDG.html


├── autopali.js
├── extra.js
├── jquery-3.7.0.min.js
├── jquery-ui.js
├── jquery-ui.min.js
├── sortableTable.js
├── sw.js


├── manifest-ru.json
├── manifest.json


├── sutta_words.txt


├── dg_icon_white-192-diamond.png
├── dg_icon_white-192-fullLogo.png
├── circle-notch.svg
├── clock-rotate-left.svg
├── gear.svg
├── globe.svg
├── magnifying-glass.svg
└── dg_icon_white-192.png -> dg_icon_white-192-diamond.png


and 

├── home.js is modified



in exporter/webapp/templates and exporter/webapp/ru_templates
├── home.html are modified
├── home_simple.html are modified 

modified in both folders

exporter/webapp/
├── main.py is heavily modified for the frontend functionality

 
