@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
CherrygroveCity_MapScripts::
	.byte 0

CherrygroveCity_EventScript_CherrygroveCityGuideGent::
	msgbox CherrygroveCity_Text_GuideGentIntroText, MSGBOX_NPC
	end

CherrygroveCity_EventScript_ObjectEvent::
	msgbox CherrygroveCity_Text_CrystalTodo, MSGBOX_NPC
	end

CherrygroveCity_EventScript_CherrygroveTeacherScript::
	msgbox CherrygroveCity_Text_CherrygroveTeacherText_NoMapCard, MSGBOX_NPC
	end

CherrygroveCity_EventScript_CherrygroveYoungsterScript::
	msgbox CherrygroveCity_Text_CherrygroveYoungsterText_NoPokedex, MSGBOX_NPC
	end

CherrygroveCity_EventScript_MysticWaterGuy::
	msgbox CherrygroveCity_Text_MysticWaterGuyTextBefore, MSGBOX_NPC
	end

CherrygroveCity_EventScript_CherrygroveRivalSceneNorth::
	lockall
	msgbox CherrygroveCity_Text_CherrygroveRivalText_Seen
	setvar VAR_SCENE_CHERRYGROVE_CITY, 2
	releaseall
	end

CherrygroveCity_EventScript_CherrygroveRivalSceneSouth::
	lockall
	setvar VAR_SCENE_CHERRYGROVE_CITY, 2
	releaseall
	end

CherrygroveCity_EventScript_CherrygroveCitySign::
	msgbox CherrygroveCity_Text_CherrygroveCitySignText, MSGBOX_SIGN
	end

CherrygroveCity_EventScript_GuideGentsHouseSign::
	msgbox CherrygroveCity_Text_GuideGentsHouseSignText, MSGBOX_SIGN
	end

CherrygroveCity_EventScript_CherrygroveCityMartSign::
	msgbox CherrygroveCity_Text_CrystalTodo, MSGBOX_SIGN
	end

CherrygroveCity_EventScript_CherrygroveCityPokecenterSign::
	msgbox CherrygroveCity_Text_CrystalTodo, MSGBOX_SIGN
	end

CherrygroveCity_Text_CrystalTodo::
	.string "…$"

CherrygroveCity_Text_CherrygroveCitySignText::
	.string "CHERRYGROVE CITY$"

CherrygroveCity_Text_CherrygroveRivalText_Seen::
	.string "… … …$"

CherrygroveCity_Text_CherrygroveTeacherText_NoMapCard::
	.string "Did you talk to\nthe old man by the\lPOKéMON CENTER?$"

CherrygroveCity_Text_CherrygroveYoungsterText_NoPokedex::
	.string "MR.POKéMON's house\nis still farther\lup ahead.$"

CherrygroveCity_Text_GuideGentIntroText::
	.string "You're a rookie\ntrainer, aren't\lyou? I can tell!$"

CherrygroveCity_Text_GuideGentsHouseSignText::
	.string "GUIDE GENT'S HOUSE$"

CherrygroveCity_Text_MysticWaterGuyTextBefore::
	.string "A POKéMON I caught\nhad an item.$"

