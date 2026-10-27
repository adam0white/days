EXTERNAL holder()
EXTERNAL helped()
EXTERNAL account()
EXTERNAL promise()
EXTERNAL checked()
EXTERNAL burak_holds()
EXTERNAL private_page()
EXTERNAL completed_promise()
EXTERNAL ate_soup()
-> door
=== door ===
# title: The door
Kemal's coat still hangs beside the door. He was Leyla's father. Leyla has three days of leave before she returns to Rotterdam. The house will remain after she goes.
// Source: human-framework research/janazah-and-taziyah-sources.md §4c, row "Prepare food for the family of Ja'far" (Abu Dawud 3132, raw). Hacer's held reading, not a narrator's rule.
Hacer, who has come to pay her respects, arrives with soup. "I think of the Prophet asking people to cook for Ja'far's family. Let us feed you. You have enough to carry." Burak, another visitor who is good with accounts, has a folded account in his pocket. On the table are a notebook and an envelope addressed to Şükrü, Kemal's old colleague from the customs office.
// Source: human-framework research/janazah-and-taziyah-sources.md §4d "Sitting to receive condolence", Hanafi Ibn Nujaym row and Shafi'i al-Shafi'i row (both cited via islamqa.info 215016, raw). Both readings are attributed; the game resolves neither.
Hacer says, "I follow the view that we can sit here for three days, if it doesn't burden you." Şükrü calls from his home across the city. He hears Hacer on the speaker. "I follow the view that these gatherings renew grief. I would close the door."
Keep a clear account and answer the promised visit before the third evening. Protect what is private. You can finish without telling anyone about your marriage.
* [Let Hacer bring the soup inside. # action:welcome]
 -> claim
* [Thank her and keep the door yourself. # action:alone]
 -> claim
=== claim ===
# title: A folded account
Burak brings two repair bills. Kemal wrote "advance returned" across both. Burak paid for an earlier repair; Şükrü paid for the boiler. The crossed-out line does not say who got their money back.
{holder()} has the receipt. {burak_holds():He unfolds it. "Let me check which repair this belongs to," he says.|Burak asks {holder()}, "Can we check which repair that receipt belongs to?"}
// Source: human-framework research/janazah-and-taziyah-sources.md §6, Tirmidhi 1078/1079 row (raw, Good per Ali Za'i), and §8.6. This is Şükrü's belief and fear; no state of Kemal is asserted or modelled.
Şükrü says, "I believe the saying that a believer's soul remains suspended by a debt until it is paid. That frightens me. I want this paid today." Burak says, "Then let's find out which bill is still open."
* [Ask Burak to check the paper before any payment. # action:check]
 -> notebook
* [Pay the first claim from your own savings. # action:pay]
 -> notebook
=== notebook ===
# title: A page folded inwards
The notebook contains a neighbour's name, a hospital address, and a page about Leyla's marriage. She never told Kemal it ended. His last note says, "Visit Şükrü. Take the envelope."
Selin comes after office hours. Hacer knows her. Selin's father, Halil, is still grieving her mother, Nuran, who died recently. "I can sit with you. I don't need the whole story."
* [Keep the page private. Find the account details without the room's help. # action:private]
 -> request
* [Read the page aloud. Get help matching the dates, at a cost to privacy. # action:read]
 -> request
=== request ===
# title: The envelope
The envelope holds an old photograph of Şükrü and a letter Kemal never sent. Şükrü lives across the city. His lift is broken. Leyla cannot leave the house and receive visitors at the same time.
Selin has her own household to get back to. Asking her to stay means asking her family to wait. Hacer says help must have a beginning and an end.
// Source: human-framework research/janazah-and-taziyah-sources.md §4a, row "Sunnah until the third day; repeating it is disliked" (MuftiOnline 112084, summarised). Burak holds this reading; he can still return to work on the bill.
Burak says, "I was taught to offer condolences once. I won't keep calling you back to that conversation. I can still help with the papers."
* [Ask Selin to delay going home and agree on a short shift tomorrow. # action:ask]
 -> morning
* [Let Selin go home. Plan to make the journey without her help. # action:hide]
 -> morning
=== morning ===
# title: The second morning
{ate_soup():The soup bowl is empty.|The soup waits by the door.} The coat has not moved. Burak can return later with his papers; nobody needs her answer this minute.
* [Eat and rest while {helped():Selin covers the door|the door is closed}. # action:rest]
 -> receipt
* [Stay at the door and skip the meal. # action:push]
 -> receipt
=== receipt ===
# title: A living witness
{checked():{holder()} brings the original receipt Leyla asked for. It records money returned to Burak for an earlier repair.|{holder()} has a phone photograph of a receipt. The edge with the recipient’s name is cut off. It may concern an earlier repair.}
{checked():It does not settle the boiler bill owed to Şükrü. The original shows that Kemal joined two separate entries on one line.|The photograph does not show who received the money. Şükrü says he has not been paid for the boiler.}
Burak says, "I was wrong to call it one account. {checked():We have the original receipt. We need to compare both entries and ask Şükrü what remains.|We need the original receipt and Şükrü to confirm what remains.}"
* [Compare the receipt with both entries in private. # action:compare]
 -> visit
* [Ask Burak to check the original by phone. Sit down while he calls. # action:guess]
 -> visit
=== visit ===
# title: Across the city
{helped():Someone has agreed to cover the door for a short shift.|Nobody has agreed to cover the door. A visit still needs a named person and a time.}
Şükrü answers the phone. "I wanted the photograph. He kept saying he would come." The letter offers no explanation for the years he did not.
* [Ask for a named visit and get Şükrü's agreement. # action:delegate]
 -> whisper
* [Arrange a later delivery with Şükrü. Give up seeing him on this trip. # action:conceal]
 -> whisper
=== whisper ===
# title: What the room may hear
Hacer hears that there is a hospital name in the notebook. "Is that why he needed money?" she asks. The person named there has not agreed to tell anyone.
The account can be checked without telling that story. Keeping the notebook means handling the questions yourself. Lending it means trusting Burak with the original.
* [Keep the notebook. {private_page():Answer questions without sharing the hospital name.|Apologise for reading the page and ask the listeners not to repeat it.} # action:protect]
 -> third
* [Lend Burak the {private_page():closed notebook|notebook you read aloud}. Let him handle the bill in private. # action:publish]
 -> third
=== third ===
# title: The third morning
The house is quieter. This is the last day of Leyla's leave. It is not the last day she will miss her father.
Şükrü says the boiler bill is still open. Burak will write the two repairs on separate lines and send the corrected bill to the person handling Kemal's papers. {checked():He can use the original receipt.|He needs the original receipt first.} Leyla can ask him to do that; she does not have to pay to end the conversation.
* [Record Şükrü's claim and Burak's agreed next step. # action:name]
 -> answer
* [Pay Şükrü yourself if the receipt confirms his bill. # action:dismiss]
 -> answer
=== answer ===
# title: An answer before departure
{promise():Şükrü has agreed to receive the photograph and letter. He still needs to hear who will bring them: Leyla herself, or Burak.|Şükrü still has no answer about the envelope.}
{account():The account now has separate entries and a named person following it.|The account still needs a recorded resolution.}
* [Make the journey yourself, if there is time. # action:confirm]
 -> witness
* [Pay for delivery. Ask Burak to take it on the agreed date. # action:leave]
 -> witness
=== witness ===
# title: A chair beside yours
On the last evening, Selin stops by after work to say goodbye. She sets down her bag. "You don't have to tell me why your marriage ended."
// Source: human-framework research/janazah-and-taziyah-sources.md §5, formal mourning/ihdad row and note distinguishing grief (contemporary, summarised). Selin speaks about her own mourning, not a ruling for Leyla.
"After my mother died, people talked about limits on mourning," Selin says. "I don't take that to mean I must stop missing her. I won't ask that of you."
Leyla can tell her one thing that belongs to Leyla: she wanted to tell Kemal, and now she cannot. Speaking keeps Selin here longer. Silence lets her leave, but Leyla keeps the words to herself.
* [Tell Selin what you wished you could say. # action:speak]
 -> evening
* [Keep this to yourself and let Selin go home. # action:silent]
 -> evening
=== evening ===
# title: The third evening
The room needs no final speech. Hacer takes her saucepan. Burak leaves a number where Leyla can reach him.{not completed_promise(): The envelope must leave with Leyla. Şükrü is still waiting for the photograph and letter.}
* [Close the door and take the next steps with you. # action:close]
 -> ending
=== ending ===
# title: After the door closes
The leave ends. The grief continues. Kemal's silence has not become an explanation. Leyla can carry unanswered questions without pretending they are answered.
-> END
