@ CRYSTAL_IMPORT_BEGIN: genererad från pokecrystal av tools/crystal_import. Ta bort raden för att handjustera.
ElmsLab_MapScripts::
	.byte 0

ElmsLab_EventScript_ProfElmScript::
	msgbox ElmsLab_Text_CrystalTodo, MSGBOX_NPC
	end

ElmsLab_EventScript_ElmsAideScript::
	msgbox ElmsLab_Text_AideText_AlwaysBusy, MSGBOX_NPC
	end

ElmsLab_EventScript_CyndaquilPokeBallScript::
	msgbox ElmsLab_Text_TakeCyndaquilText, MSGBOX_NPC
	end

ElmsLab_EventScript_TotodilePokeBallScript::
	msgbox ElmsLab_Text_TakeTotodileText, MSGBOX_NPC
	end

ElmsLab_EventScript_ChikoritaPokeBallScript::
	msgbox ElmsLab_Text_TakeChikoritaText, MSGBOX_NPC
	end

ElmsLab_EventScript_CopScript::
	msgbox ElmsLab_Text_ElmsLabOfficerText1, MSGBOX_NPC
	end

ElmsLab_EventScript_LabTryToLeaveScript::
	lockall
	msgbox ElmsLab_Text_LabWhereGoingText
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_MeetCopScript::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_MeetCopScript2::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_AideScript_WalkPotion1::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_AideScript_WalkPotion2::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_AideScript_WalkBalls1::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_AideScript_WalkBalls2::
	lockall
	setvar VAR_SCENE_ELMS_LAB, 1
	releaseall
	end

ElmsLab_EventScript_ElmsLabHealingMachine::
	msgbox ElmsLab_Text_ElmsLabHealingMachineText1, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabBookshelf::
	msgbox ElmsLab_Text_CrystalTodo, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabTravelTip1::
	msgbox ElmsLab_Text_ElmsLabTravelTip1Text, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabTravelTip2::
	msgbox ElmsLab_Text_ElmsLabTravelTip2Text, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabTravelTip3::
	msgbox ElmsLab_Text_ElmsLabTravelTip3Text, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabTravelTip4::
	msgbox ElmsLab_Text_ElmsLabTravelTip4Text, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabTrashcan::
	msgbox ElmsLab_Text_ElmsLabTrashcanText, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabWindow::
	msgbox ElmsLab_Text_CrystalTodo, MSGBOX_SIGN
	end

ElmsLab_EventScript_ElmsLabPC::
	msgbox ElmsLab_Text_ElmsLabPCText, MSGBOX_SIGN
	end

ElmsLab_Text_CrystalTodo::
	.string "…$"

ElmsLab_Text_AideText_AlwaysBusy::
	.string "There are only two\nof us, so we're\lalways busy.$"

ElmsLab_Text_ElmsLabHealingMachineText1::
	.string "I wonder what this\ndoes?$"

ElmsLab_Text_ElmsLabOfficerText1::
	.string "I heard a POKéMON\nwas stolen here…$"

ElmsLab_Text_ElmsLabPCText::
	.string "OBSERVATIONS ON\nPOKéMON EVOLUTION$"

ElmsLab_Text_ElmsLabTrashcanText::
	.string "The wrapper from\nthe snack PROF.ELM\late is in there…$"

ElmsLab_Text_ElmsLabTravelTip1Text::
	.string "{PLAYER} opened a\nbook.$"

ElmsLab_Text_ElmsLabTravelTip2Text::
	.string "{PLAYER} opened a\nbook.$"

ElmsLab_Text_ElmsLabTravelTip3Text::
	.string "{PLAYER} opened a\nbook.$"

ElmsLab_Text_ElmsLabTravelTip4Text::
	.string "{PLAYER} opened a\nbook.$"

ElmsLab_Text_LabWhereGoingText::
	.string "ELM: Wait! Where\nare you going?$"

ElmsLab_Text_TakeChikoritaText::
	.string "ELM: So, you like\nCHIKORITA, the\lgrass POKéMON?$"

ElmsLab_Text_TakeCyndaquilText::
	.string "ELM: You'll take\nCYNDAQUIL, the\lfire POKéMON?$"

ElmsLab_Text_TakeTotodileText::
	.string "ELM: Do you want\nTOTODILE, the\lwater POKéMON?$"

