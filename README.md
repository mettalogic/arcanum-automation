# arcanum-automation
Automation script for Arcanum web game

This Greasemonkey script automates various tasks in the Arcanum web browser game available from Kongregate (where it's called "Theory of Magic"):
https://www.kongregate.com/games/lerpinglemur/theory-of-magic
and from the author's web site:
http://www.lerpinglemur.com/arcanum/

Tasks automated include:
- Making/purchasing scrolls, codices, gems when gold/research is full
- Selling herbs when full
- Regularly casting spell buffs which have been learnt
- Adding an option on the quickbar to specify a time - buttons will be clicked every time interval
- Adding a filter function and additional sell buttons for equipment while adventuring
- Actively clicking focus while learning a skill
  
Note: the script requires you to visit the "Spells" option to learn new spells.


The Browser sub-directory contains a JSON browser written in C++ using the QT toolkit. It's only been tested on Linux, but should be cross-platform. On startup it will ask for a directory containing the Arcanum JSON files, it will read "*.json" in that directory. There are several tabs in the GUI, some of which were added to help create content on the wiki, but the most useful two are:
 - Tree view which compacts each "item" (e.g. each spell, effect, home etc.) in the json file into a single row, making it easy to compare items. Click on headers to sort columns.
 - Search Results - type a string into the Search field and press RETURN, and it will search for that string across all the JSON files.
 
Note that the file "seasonal.json" is mostly ignored currently as it has a slightly different layout.
