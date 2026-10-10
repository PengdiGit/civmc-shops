// Active CivMC nations + settlements from CivWiki (active rows only).
// Sources: List of nations on CivMC + nation infoboxes + IF states list.
// Regenerate with: python _scrape_places.py
const CIVMC_PLACES = {
  "nations": [
    "Aequoris",
    "Amboise",
    "Anisso",
    "Arx City",
    "Aspasia",
    "Baile",
    "Bananaland and Soria",
    "Bloom",
    "Chromatia",
    "Columbia",
    "Commonwealth",
    "Danzilona",
    "Dirt",
    "Doom City",
    "Estalia",
    "Fairhill",
    "Fempire Union",
    "Gothia",
    "Griffin",
    "Groveheart",
    "Heikki",
    "Icarus",
    "Icenia",
    "Ila'Kyavul",
    "Imperial Federation",
    "Kaiyaukuta",
    "Kaltsburg",
    "Lambat",
    "Lusitania",
    "Mairé",
    "Melvera",
    "Mount Augusta",
    "Nara",
    "Nassau",
    "Neo Sol",
    "Northfort",
    "Novosibirsk",
    "Orient",
    "Pacem",
    "Pavia",
    "Rivia",
    "Ruby",
    "Salerno",
    "Selene",
    "Skandic",
    "Solara",
    "SPQR",
    "STONE",
    "Temporal Empire",
    "Themisara",
    "Union State",
    "Valtoria",
    "Velmara",
    "Vinland",
    "Volterra",
    "Westhelm",
    "Whiskia",
    "Winterbourne",
    "Withervale",
    "Woolhaven",
    "Yoahtl",
    "Yumeshima",
    "Zatoka"
  ],
  "byNation": {
    "Aequoris": [
      "Thorn",
      "Yumesshima",
      "Dion"
    ],
    "Amboise": [
      "Amboise"
    ],
    "Anisso": [
      "Rozzano"
    ],
    "Arx City": [
      "Arx City"
    ],
    "Aspasia": [
      "Astrophile",
      "Shu'kar",
      "Suðreyjar"
    ],
    "Baile": [
      "Baile City",
      "As'Kuyea",
      "The Underground",
      "Overtown",
      "Fjallborg",
      "Azarath",
      "Haus"
    ],
    "Bananaland and Soria": [
      "Soria",
      "Nordia",
      "Accra"
    ],
    "Bloom": [
      "Bloom City",
      "Lilly",
      "Cape Meridian",
      "Kattegat"
    ],
    "Chromatia": [
      "Chromatia"
    ],
    "Columbia": [
      "Columbia City"
    ],
    "Commonwealth": [
      "Commonwealth"
    ],
    "Danzilona": [
      "New Danzilona"
    ],
    "Dirt": [
      "Dirt"
    ],
    "Doom City": [
      "Doom City"
    ],
    "Estalia": [
      "Port Royal",
      "Suramir",
      "Shroom City",
      "Zorweth"
    ],
    "Fairhill": [
      "Fairhill City",
      "Concordia",
      "Founder's Vale",
      "Copper Creek"
    ],
    "Fempire Union": [
      "Mosskow",
      "Farmingrad"
    ],
    "Gothia": [
      "Point Hope"
    ],
    "Griffin": [
      "Adria",
      "Griffin"
    ],
    "Groveheart": [
      "Groveheart City",
      "Groveheart"
    ],
    "Heikki": [
      "Käo",
      "Halifax",
      "Heikki"
    ],
    "Icarus": [
      "Blue Cove",
      "Derne",
      "Port Elowen",
      "Temporal Isles"
    ],
    "Icenia": [
      "Icenia City",
      "Selene",
      "Cortesia Del Mar",
      "Southshire",
      "Pacem",
      "Selsey",
      "Sneedland",
      "Basaltington"
    ],
    "Ila'Kyavul": [
      "Kay'evenya",
      "Kyanroja"
    ],
    "Imperial Federation": [
      "New Callisto",
      "Imperia",
      "Regentsburgh",
      "Regensburg",
      "Godhaven",
      "Waterside",
      "FELINE",
      "Anor Londo X",
      "Pridelands",
      "Esberg-Ostersund",
      "Esberg",
      "Stros M'Kai",
      "Grenada",
      "Halland",
      "Midgard",
      "Vanaheim",
      "Comanche",
      "Freeport",
      "Meriecta",
      "Söderrike",
      "Nalora",
      "Vouxia",
      "Landshut",
      "Elyras",
      "Slothistan",
      "Thule",
      "Goatia",
      "Alcantara",
      "Voldi",
      "Karydian Union",
      "Meridionalis",
      "New Haven",
      "Hydris",
      "Cyania",
      "South America",
      "Rayos"
    ],
    "Kaiyaukuta": [
      "Strandbury",
      "Mooborough",
      "Saint Foog",
      "Nashburg",
      "Cliffwick"
    ],
    "Kaltsburg": [
      "Kronnstadt",
      "Kaltsburg"
    ],
    "Lambat": [
      "Poblacion",
      "Lambat City"
    ],
    "Lusitania": [
      "Lusitania"
    ],
    "Mairé": [
      "Siobrán"
    ],
    "Melvera": [
      "Aurilles",
      "Bushberry",
      "Old Lynxwood"
    ],
    "Mount Augusta": [
      "Mount Augusta"
    ],
    "Nara": [
      "Shiroyama",
      "Karasu",
      "Orakuru",
      "Nara"
    ],
    "Nassau": [
      "Nassau"
    ],
    "Neo Sol": [
      "Neo Sol",
      "Concord"
    ],
    "Northfort": [
      "Northfort"
    ],
    "Novosibirsk": [
      "Novosibirsk"
    ],
    "Orient": [
      "Cluj-Napoca"
    ],
    "Pacem": [
      "Pacem"
    ],
    "Pavia": [
      "Pavia City"
    ],
    "Rivia": [
      "Rivia City"
    ],
    "Ruby": [
      "Piave",
      "Ruby",
      "Carcosa"
    ],
    "Salerno": [
      "Brunsvik",
      "Salerno"
    ],
    "Selene": [
      "Selene"
    ],
    "Solara": [
      "Solara"
    ],
    "Skandic": [
      "Skandic City"
    ],
    "SPQR": [
      "Roma",
      "City of England",
      "Solis",
      "Lugdunum",
      "Septentria",
      "Tenochtitlan"
    ],
    "STONE": [
      "STONE"
    ],
    "Temporal Empire": [
      "Aika Nivella"
    ],
    "Themisara": [
      "Rosewood",
      "Duckworth"
    ],
    "Union State": [
      "Minerva",
      "Kopernik"
    ],
    "Valtoria": [
      "Königsburg"
    ],
    "Velmara": [
      "Velmara City"
    ],
    "Vinland": [
      "Mordheim City"
    ],
    "Volterra": [
      "Volterra"
    ],
    "Westhelm": [
      "City of Westhelm"
    ],
    "Whiskia": [
      "Libertea"
    ],
    "Winterbourne": [
      "Wintercastle",
      "Winterbourne"
    ],
    "Withervale": [
      "Withervale"
    ],
    "Woolhaven": [
      "Lamb's Rest"
    ],
    "Yoahtl": [
      "New Yoahtl City"
    ],
    "Yumeshima": [
      "Hoshimachi",
      "Chiyoda-ura",
      "Kasumi-gaoka",
      "Kōgyō-en",
      "Soraminato"
    ],
    "Zatoka": [
      "Kopernik (Administrative)",
      "Casimir (Cultural)",
      "Manisa (Financial)"
    ]
  },
  "cities": [
    "Accra",
    "Adria",
    "Aika Nivella",
    "Alcantara",
    "Amboise",
    "Anor Londo X",
    "Arx City",
    "As'Kuyea",
    "Astrophile",
    "Aurilles",
    "Azarath",
    "Baile City",
    "Basaltington",
    "Bloom City",
    "Blue Cove",
    "Brunsvik",
    "Bushberry",
    "Cape Meridian",
    "Carcosa",
    "Casimir (Cultural)",
    "Chiyoda-ura",
    "Chromatia",
    "City of England",
    "City of Westhelm",
    "Cliffwick",
    "Cluj-Napoca",
    "Columbia City",
    "Comanche",
    "Commonwealth",
    "Concord",
    "Concordia",
    "Copper Creek",
    "Cortesia Del Mar",
    "Cyania",
    "Derne",
    "Dion",
    "Dirt",
    "Doom City",
    "Duckworth",
    "Elyras",
    "Esberg",
    "Esberg-Ostersund",
    "Fairhill City",
    "Farmingrad",
    "FELINE",
    "Fjallborg",
    "Founder's Vale",
    "Freeport",
    "Goatia",
    "Godhaven",
    "Grenada",
    "Griffin",
    "Groveheart",
    "Groveheart City",
    "Halifax",
    "Halland",
    "Haus",
    "Heikki",
    "Hoshimachi",
    "Hydris",
    "Icenia City",
    "Imperia",
    "Kaltsburg",
    "Karasu",
    "Karydian Union",
    "Kasumi-gaoka",
    "Kattegat",
    "Kay'evenya",
    "Kopernik",
    "Kopernik (Administrative)",
    "Kronnstadt",
    "Kyanroja",
    "Käo",
    "Königsburg",
    "Kōgyō-en",
    "Lamb's Rest",
    "Lambat City",
    "Landshut",
    "Libertea",
    "Lilly",
    "Lugdunum",
    "Lusitania",
    "Manisa (Financial)",
    "Meridionalis",
    "Meriecta",
    "Midgard",
    "Minerva",
    "Mooborough",
    "Mordheim City",
    "Mosskow",
    "Mount Augusta",
    "Nalora",
    "Nara",
    "Nashburg",
    "Nassau",
    "Neo Sol",
    "New Callisto",
    "New Danzilona",
    "New Haven",
    "New Yoahtl City",
    "Nordia",
    "Northfort",
    "Novosibirsk",
    "Old Lynxwood",
    "Orakuru",
    "Overtown",
    "Pacem",
    "Pavia City",
    "Piave",
    "Poblacion",
    "Point Hope",
    "Port Elowen",
    "Port Royal",
    "Pridelands",
    "Rayos",
    "Regensburg",
    "Regentsburgh",
    "Rivia City",
    "Roma",
    "Rosewood",
    "Rozzano",
    "Ruby",
    "Saint Foog",
    "Salerno",
    "Selene",
    "Selsey",
    "Septentria",
    "Shiroyama",
    "Shroom City",
    "Shu'kar",
    "Siobrán",
    "Skandic City",
    "Slothistan",
    "Sneedland",
    "Solara",
    "Solis",
    "Soraminato",
    "Soria",
    "South America",
    "Southshire",
    "STONE",
    "Strandbury",
    "Stros M'Kai",
    "Suramir",
    "Suðreyjar",
    "Söderrike",
    "Temporal Isles",
    "Tenochtitlan",
    "The Underground",
    "Thorn",
    "Thule",
    "Vanaheim",
    "Velmara City",
    "Voldi",
    "Volterra",
    "Vouxia",
    "Waterside",
    "Winterbourne",
    "Wintercastle",
    "Withervale",
    "Yumesshima",
    "Zorweth"
  ],
  "cityNations": {
    "Thorn": [
      "Aequoris"
    ],
    "Yumesshima": [
      "Aequoris"
    ],
    "Dion": [
      "Aequoris"
    ],
    "Amboise": [
      "Amboise"
    ],
    "Rozzano": [
      "Anisso"
    ],
    "Arx City": [
      "Arx City"
    ],
    "Astrophile": [
      "Aspasia"
    ],
    "Shu'kar": [
      "Aspasia"
    ],
    "Suðreyjar": [
      "Aspasia"
    ],
    "Baile City": [
      "Baile"
    ],
    "As'Kuyea": [
      "Baile"
    ],
    "The Underground": [
      "Baile"
    ],
    "Overtown": [
      "Baile"
    ],
    "Fjallborg": [
      "Baile"
    ],
    "Azarath": [
      "Baile"
    ],
    "Haus": [
      "Baile"
    ],
    "Soria": [
      "Bananaland and Soria"
    ],
    "Nordia": [
      "Bananaland and Soria"
    ],
    "Accra": [
      "Bananaland and Soria"
    ],
    "Bloom City": [
      "Bloom"
    ],
    "Lilly": [
      "Bloom"
    ],
    "Cape Meridian": [
      "Bloom"
    ],
    "Kattegat": [
      "Bloom"
    ],
    "Chromatia": [
      "Chromatia"
    ],
    "Columbia City": [
      "Columbia"
    ],
    "Commonwealth": [
      "Commonwealth"
    ],
    "New Danzilona": [
      "Danzilona"
    ],
    "Dirt": [
      "Dirt"
    ],
    "Doom City": [
      "Doom City"
    ],
    "Port Royal": [
      "Estalia"
    ],
    "Suramir": [
      "Estalia"
    ],
    "Shroom City": [
      "Estalia"
    ],
    "Zorweth": [
      "Estalia"
    ],
    "Fairhill City": [
      "Fairhill"
    ],
    "Concordia": [
      "Fairhill"
    ],
    "Founder's Vale": [
      "Fairhill"
    ],
    "Copper Creek": [
      "Fairhill"
    ],
    "Mosskow": [
      "Fempire Union"
    ],
    "Farmingrad": [
      "Fempire Union"
    ],
    "Point Hope": [
      "Gothia"
    ],
    "Adria": [
      "Griffin"
    ],
    "Griffin": [
      "Griffin"
    ],
    "Groveheart City": [
      "Groveheart"
    ],
    "Groveheart": [
      "Groveheart"
    ],
    "Käo": [
      "Heikki"
    ],
    "Halifax": [
      "Heikki"
    ],
    "Heikki": [
      "Heikki"
    ],
    "Blue Cove": [
      "Icarus"
    ],
    "Derne": [
      "Icarus"
    ],
    "Port Elowen": [
      "Icarus"
    ],
    "Temporal Isles": [
      "Icarus"
    ],
    "Icenia City": [
      "Icenia"
    ],
    "Selene": [
      "Icenia",
      "Selene"
    ],
    "Cortesia Del Mar": [
      "Icenia"
    ],
    "Southshire": [
      "Icenia"
    ],
    "Pacem": [
      "Icenia",
      "Pacem"
    ],
    "Selsey": [
      "Icenia"
    ],
    "Sneedland": [
      "Icenia"
    ],
    "Basaltington": [
      "Icenia"
    ],
    "Kay'evenya": [
      "Ila'Kyavul"
    ],
    "Kyanroja": [
      "Ila'Kyavul"
    ],
    "New Callisto": [
      "Imperial Federation"
    ],
    "Imperia": [
      "Imperial Federation"
    ],
    "Regentsburgh": [
      "Imperial Federation"
    ],
    "Regensburg": [
      "Imperial Federation"
    ],
    "Godhaven": [
      "Imperial Federation"
    ],
    "Waterside": [
      "Imperial Federation"
    ],
    "FELINE": [
      "Imperial Federation"
    ],
    "Anor Londo X": [
      "Imperial Federation"
    ],
    "Pridelands": [
      "Imperial Federation"
    ],
    "Esberg-Ostersund": [
      "Imperial Federation"
    ],
    "Esberg": [
      "Imperial Federation"
    ],
    "Stros M'Kai": [
      "Imperial Federation"
    ],
    "Grenada": [
      "Imperial Federation"
    ],
    "Halland": [
      "Imperial Federation"
    ],
    "Midgard": [
      "Imperial Federation"
    ],
    "Vanaheim": [
      "Imperial Federation"
    ],
    "Comanche": [
      "Imperial Federation"
    ],
    "Freeport": [
      "Imperial Federation"
    ],
    "Meriecta": [
      "Imperial Federation"
    ],
    "Söderrike": [
      "Imperial Federation"
    ],
    "Nalora": [
      "Imperial Federation"
    ],
    "Vouxia": [
      "Imperial Federation"
    ],
    "Landshut": [
      "Imperial Federation"
    ],
    "Elyras": [
      "Imperial Federation"
    ],
    "Slothistan": [
      "Imperial Federation"
    ],
    "Thule": [
      "Imperial Federation"
    ],
    "Goatia": [
      "Imperial Federation"
    ],
    "Alcantara": [
      "Imperial Federation"
    ],
    "Voldi": [
      "Imperial Federation"
    ],
    "Karydian Union": [
      "Imperial Federation"
    ],
    "Meridionalis": [
      "Imperial Federation"
    ],
    "New Haven": [
      "Imperial Federation"
    ],
    "Hydris": [
      "Imperial Federation"
    ],
    "Cyania": [
      "Imperial Federation"
    ],
    "South America": [
      "Imperial Federation"
    ],
    "Rayos": [
      "Imperial Federation"
    ],
    "Strandbury": [
      "Kaiyaukuta"
    ],
    "Mooborough": [
      "Kaiyaukuta"
    ],
    "Saint Foog": [
      "Kaiyaukuta"
    ],
    "Nashburg": [
      "Kaiyaukuta"
    ],
    "Cliffwick": [
      "Kaiyaukuta"
    ],
    "Kronnstadt": [
      "Kaltsburg"
    ],
    "Kaltsburg": [
      "Kaltsburg"
    ],
    "Poblacion": [
      "Lambat"
    ],
    "Lambat City": [
      "Lambat"
    ],
    "Lusitania": [
      "Lusitania"
    ],
    "Siobrán": [
      "Mairé"
    ],
    "Aurilles": [
      "Melvera"
    ],
    "Bushberry": [
      "Melvera"
    ],
    "Old Lynxwood": [
      "Melvera"
    ],
    "Mount Augusta": [
      "Mount Augusta"
    ],
    "Shiroyama": [
      "Nara"
    ],
    "Karasu": [
      "Nara"
    ],
    "Orakuru": [
      "Nara"
    ],
    "Nara": [
      "Nara"
    ],
    "Nassau": [
      "Nassau"
    ],
    "Neo Sol": [
      "Neo Sol"
    ],
    "Concord": [
      "Neo Sol"
    ],
    "Northfort": [
      "Northfort"
    ],
    "Novosibirsk": [
      "Novosibirsk"
    ],
    "Cluj-Napoca": [
      "Orient"
    ],
    "Pavia City": [
      "Pavia"
    ],
    "Rivia City": [
      "Rivia"
    ],
    "Piave": [
      "Ruby"
    ],
    "Ruby": [
      "Ruby"
    ],
    "Carcosa": [
      "Ruby"
    ],
    "Brunsvik": [
      "Salerno"
    ],
    "Salerno": [
      "Salerno"
    ],
    "Solara": [
      "Solara"
    ],
    "Skandic City": [
      "Skandic"
    ],
    "Roma": [
      "SPQR"
    ],
    "City of England": [
      "SPQR"
    ],
    "Solis": [
      "SPQR"
    ],
    "Lugdunum": [
      "SPQR"
    ],
    "Septentria": [
      "SPQR"
    ],
    "Tenochtitlan": [
      "SPQR"
    ],
    "STONE": [
      "STONE"
    ],
    "Aika Nivella": [
      "Temporal Empire"
    ],
    "Rosewood": [
      "Themisara"
    ],
    "Duckworth": [
      "Themisara"
    ],
    "Minerva": [
      "Union State"
    ],
    "Kopernik": [
      "Union State"
    ],
    "Königsburg": [
      "Valtoria"
    ],
    "Velmara City": [
      "Velmara"
    ],
    "Mordheim City": [
      "Vinland"
    ],
    "Volterra": [
      "Volterra"
    ],
    "City of Westhelm": [
      "Westhelm"
    ],
    "Libertea": [
      "Whiskia"
    ],
    "Wintercastle": [
      "Winterbourne"
    ],
    "Winterbourne": [
      "Winterbourne"
    ],
    "Withervale": [
      "Withervale"
    ],
    "Lamb's Rest": [
      "Woolhaven"
    ],
    "New Yoahtl City": [
      "Yoahtl"
    ],
    "Hoshimachi": [
      "Yumeshima"
    ],
    "Chiyoda-ura": [
      "Yumeshima"
    ],
    "Kasumi-gaoka": [
      "Yumeshima"
    ],
    "Kōgyō-en": [
      "Yumeshima"
    ],
    "Soraminato": [
      "Yumeshima"
    ],
    "Kopernik (Administrative)": [
      "Zatoka"
    ],
    "Casimir (Cultural)": [
      "Zatoka"
    ],
    "Manisa (Financial)": [
      "Zatoka"
    ]
  },
  "source": "https://civwiki.org/wiki/List_of_nations_on_CivMC",
  "updated": "2026-10-11"
};
