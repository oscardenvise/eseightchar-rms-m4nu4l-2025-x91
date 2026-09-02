@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
ElmsHouse_MapScripts::
	.byte 0

ElmsHouse_EventScript_ElmsWife::
	msgbox ElmsHouse_Text_ElmsWifeText, MSGBOX_NPC
	end

ElmsHouse_EventScript_ElmsSon::
	msgbox ElmsHouse_Text_ElmsSonText, MSGBOX_NPC
	end

ElmsHouse_EventScript_ElmsHousePC::
	msgbox ElmsHouse_Text_ElmsHousePCText, MSGBOX_SIGN
	end

ElmsHouse_EventScript_ElmsHouseBookshelf::
	msgbox ElmsHouse_Text_CrystalTodo, MSGBOX_SIGN
	end

ElmsHouse_Text_CrystalTodo::
	.string "…$"

ElmsHouse_Text_ElmsHousePCText::
	.string "POKéMON. Where do\nthey come from? $"

ElmsHouse_Text_ElmsSonText::
	.string "When I grow up,\nI'm going to help\lmy dad!$"

ElmsHouse_Text_ElmsWifeText::
	.string "Hi, {PLAYER}! My\nhusband's always$"

