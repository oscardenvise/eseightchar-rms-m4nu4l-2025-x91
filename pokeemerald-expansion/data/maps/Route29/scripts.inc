@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
Route29_MapScripts::
	.byte 0

Route29_EventScript_CatchingTutorialDudeScript::
	msgbox Route29_Text_CatchingTutorialRepeatText, MSGBOX_NPC
	end

Route29_EventScript_Route29YoungsterScript::
	msgbox Route29_Text_Route29YoungsterText, MSGBOX_NPC
	end

Route29_EventScript_Route29TeacherScript::
	msgbox Route29_Text_Route29TeacherText, MSGBOX_NPC
	end

Route29_EventScript_Route29FruitTree::
	msgbox Route29_Text_CrystalTodo, MSGBOX_NPC
	end

Route29_EventScript_Route29FisherScript::
	msgbox Route29_Text_Route29FisherText, MSGBOX_NPC
	end

Route29_EventScript_Route29CooltrainerMScript::
	msgbox Route29_Text_CrystalTodo, MSGBOX_NPC
	end

Route29_EventScript_TuscanyScript::
	msgbox Route29_Text_MeetTuscanyText, MSGBOX_NPC
	end

Route29_EventScript_Route29Potion::
	finditem ITEM_POTION
	end

Route29_EventScript_Route29Tutorial1::
	lockall
	msgbox Route29_Text_CatchingTutorialIntroText
	setvar VAR_SCENE_ROUTE_29, 2
	releaseall
	end

Route29_EventScript_Route29Tutorial2::
	lockall
	msgbox Route29_Text_CatchingTutorialIntroText
	setvar VAR_SCENE_ROUTE_29, 2
	releaseall
	end

Route29_EventScript_Route29Sign1::
	msgbox Route29_Text_Route29Sign1Text, MSGBOX_SIGN
	end

Route29_EventScript_Route29Sign2::
	msgbox Route29_Text_Route29Sign2Text, MSGBOX_SIGN
	end

Route29_Text_CrystalTodo::
	.string "…$"

Route29_Text_CatchingTutorialIntroText::
	.string "I've seen you a\ncouple times. How$"

Route29_Text_CatchingTutorialRepeatText::
	.string "Huh? You want me\nto show you how to\lcatch POKéMON?$"

Route29_Text_MeetTuscanyText::
	.string "TUSCANY: I do be-\nlieve that this is$"

Route29_Text_Route29FisherText::
	.string "I wanted to take a\nbreak, so I saved$"

Route29_Text_Route29Sign1Text::
	.string "ROUTE 29$"

Route29_Text_Route29Sign2Text::
	.string "ROUTE 29$"

Route29_Text_Route29TeacherText::
	.string "See those ledges?\nIt's scary to jump\loff them.$"

Route29_Text_Route29YoungsterText::
	.string "Yo. How are your\nPOKéMON?$"

