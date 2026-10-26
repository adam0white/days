EXTERNAL holder()
EXTERNAL helped()
EXTERNAL account()
EXTERNAL promise()
EXTERNAL checked()
-> door
=== door ===
# title: The door
Kemal's coat still hangs beside the door. Leyla has three days of leave before she returns to Rotterdam. The house will remain after she goes.
Hacer arrives with soup. "You can sit down. I brought enough." Burak has a folded account in his pocket. On the table is a notebook addressed to Şükrü.
Keep a clear account, arrange the promised visit, and speak honestly without exposing someone else's private life before the third evening.
* [Let Hacer bring the soup inside. # action:welcome]
 -> claim
* [Thank her and keep the door yourself. # action:alone]
 -> claim
=== claim ===
# title: A folded account
Burak says Kemal still owed Şükrü for a repaired boiler. The paper says "advance returned" beside a crossed-out amount. Burak cannot tell whose advance it was.
"Someone saw the transfer," he says. "{holder()} may have the receipt."
* [Ask Burak to check the paper before any payment. # action:check]
 -> notebook
* [Pay the first claim from your own savings. # action:pay]
 -> notebook
=== notebook ===
# title: A page folded inwards
The notebook contains a neighbour's name, a hospital address, and a page about Leyla's marriage. She never told Kemal it ended. His last note says, "Visit Şükrü. Take the envelope."
Selin comes after office hours. She is Halil's daughter. Her mother, Nuran, died recently. "I can sit with you. I don't need the whole story."
* [Keep the page private. Ask about the envelope alone. # action:private]
 -> request
* [Read the whole page aloud to explain yourself. # action:read]
 -> request
=== request ===
# title: The envelope
The envelope holds an old photograph of Şükrü and a letter Kemal never sent. Şükrü lives across the city. His lift is broken. You cannot leave the house and receive visitors at the same time.
Selin has her own household to get back to. Hacer says help must have a beginning and an end.
* [Ask for a short, agreed shift at the door tomorrow. # action:ask]
 -> morning
* [Put the envelope away. Say nothing about the visit. # action:hide]
 -> morning
=== morning ===
# title: The second morning
The soup bowl is empty. The coat has not moved. Leyla has slept badly. Burak can return later with his papers; nobody needs her answer this minute.
* [Eat and rest while the door is covered or closed. # action:rest]
 -> receipt
* [Stay at the door and skip the meal. # action:push]
 -> receipt
=== receipt ===
# title: A living witness
{checked():{holder()} brings the original receipt you requested. It records money returned to Burak for an earlier repair.|{holder()} has a phone photograph of a receipt. The edge with the recipient’s name is cut off. It may concern an earlier repair.}
{checked():It does not settle the boiler bill owed to Şükrü. The original shows that Kemal joined two separate entries on one line.|Burak thinks it concerns a separate advance, but the cropped copy cannot establish whose. Şükrü's claimed boiler bill still needs its own check.}
Burak says, "I was wrong to call it one account. We need the original receipt and Şükrü to confirm what remains."
* [Compare the receipt with both entries in private. # action:compare]
 -> visit
* [Treat the crossed-out line as proof that nothing is owed. # action:guess]
 -> visit
=== visit ===
# title: Across the city
{helped():Someone has agreed to cover the door for a short shift.|Nobody has agreed to cover the door. A visit still needs a named person and a time.}
Şükrü answers the phone. "I wanted the photograph. He kept saying he would come." The letter offers no explanation for the years he did not.
* [Ask for a named visit and get Şükrü's agreement. # action:delegate]
 -> whisper
* [Close the envelope and let the promise disappear. # action:conceal]
 -> whisper
=== whisper ===
# title: What the room may hear
Hacer hears that there is a hospital name in the notebook. "Is that why he needed money?" she asks. The person named there has not agreed to tell anyone.
The account can be checked without telling that story.
* [Keep the hospital page closed. Share only the bill. # action:protect]
 -> third
* [Show the page to everyone to stop the questions. # action:publish]
 -> third
=== third ===
# title: The third morning
The house is quieter. This is the last day of Leyla's leave. It is not the last day she will miss her father.
Şükrü says the boiler bill is still open. Burak offers to obtain a corrected statement and contact the person handling Kemal's estate, if the earlier transfer can be identified. Nobody is asking Leyla to buy an answer with her savings.
* [Record Şükrü's claim and Burak's agreed next step. # action:name]
 -> answer
* [Tell Şükrü that Kemal must have paid already. # action:dismiss]
 -> answer
=== answer ===
# title: An answer before departure
{promise():Şükrü has agreed to receive the photograph and letter. He needs to know who is coming.|Şükrü still has no answer about the envelope.}
{account():The account now has separate entries and a named person following it.|The two entries are still being treated as one.}
* [Confirm the visit with its named person, or go yourself. # action:confirm]
 -> witness
* [Leave the envelope where it is. # action:leave]
 -> witness
=== witness ===
# title: A chair beside yours
Selin sits down before she puts her bag on her shoulder. "You don't have to tell me why your marriage ended."
Leyla can tell her one thing that belongs to Leyla: she wanted to tell Kemal, and now she cannot.
* [Tell Selin what you wished you could say. # action:speak]
 -> evening
* [Say that everything has been dealt with. # action:silent]
 -> evening
=== evening ===
# title: The third evening
The room needs no final speech. Hacer takes her saucepan. Burak leaves a number where Leyla can reach him. The envelope must leave with Leyla if its visit is still unanswered.
* [Close the door and take the next steps with you. # action:close]
 -> ending
=== ending ===
# title: After the door closes
The leave ends. The grief continues. Kemal's silence has not become an explanation. Leyla can carry unanswered questions without pretending they are answered.
-> END
