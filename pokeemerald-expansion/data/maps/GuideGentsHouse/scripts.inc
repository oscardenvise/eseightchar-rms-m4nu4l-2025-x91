@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
GuideGentsHouse_MapScripts::
	.byte 0

GuideGentsHouse_EventScript_GuideGentsHouseGuideGent::
	msgbox GuideGentsHouse_Text_GuideGentsHouseGuideGentText, MSGBOX_NPC
	end

GuideGentsHouse_EventScript_GuideGentsHouseBookshelf::
	msgbox GuideGentsHouse_Text_CrystalTodo, MSGBOX_SIGN
	end

GuideGentsHouse_Text_CrystalTodo::
	.string "…$"

GuideGentsHouse_Text_GuideGentsHouseGuideGentText::
	.string "When I was a wee\nlad, I was a hot-\lshot trainer!$"

