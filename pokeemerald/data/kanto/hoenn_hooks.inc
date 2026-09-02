@ Koppling mellan Hoenn och Kanto: sjömän som seglar mellan Littleroot Town och Pallet Town.
@ Handskrivet; inkluderas via data/kanto/event_scripts.inc.
Kanto_EventScript_SailorToKanto::
	lock
	faceplayer
	msgbox Kanto_Text_SailToKanto, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, Kanto_EventScript_SailorDecline
	msgbox Kanto_Text_AllAboard
	closemessage
	warp MAP_PALLET_TOWN, 5, 13
	waitstate
	release
	end

Kanto_EventScript_SailorToHoenn::
	lock
	faceplayer
	msgbox Kanto_Text_SailToHoenn, MSGBOX_YESNO
	goto_if_eq VAR_RESULT, NO, Kanto_EventScript_SailorDecline
	msgbox Kanto_Text_AllAboard
	closemessage
	warp MAP_LITTLEROOT_TOWN, 10, 13
	waitstate
	release
	end

Kanto_EventScript_SailorDecline::
	msgbox Kanto_Text_ComeBackAnytime
	release
	end

Kanto_Text_SailToKanto::
	.string "Ahoy! My ship sails to PALLET TOWN\n"
	.string "in the KANTO region.\p"
	.string "Want to come aboard?$"

Kanto_Text_SailToHoenn::
	.string "Ahoy! My ship sails back to\n"
	.string "LITTLEROOT TOWN in HOENN.\p"
	.string "Want to come aboard?$"

Kanto_Text_AllAboard::
	.string "All aboard!$"

Kanto_Text_ComeBackAnytime::
	.string "Come back anytime!$"
