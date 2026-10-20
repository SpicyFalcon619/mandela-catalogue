/**
 * Premade fan theories. Every one is unconfirmed: none is stated by Alex Kister or by the videos in so many words.
 * They come from the speculation sections of the series fan wiki (CC BY-SA), re-worded, and from readings of the
 * tapes that are labelled as readings. "standing" says how much the tapes themselves lean one way, never that a theory
 * is true. Tape ids are the seeded tape ids (release order): 1 overthrone, 2 Vol. 1, 3 intruder alert, 4 exhibition,
 * 5 Vol. 2, 6 Vol. 333, 7 every day gets brighter, 8 interlude, 9 Vol. 4, 10 Easter clips, 11 mandela catalyst,
 * 12 Presto, 13 1_19_09 221a, 14 2:38, 15 Vol. 5, 16 Unraveling Pt. 1, 17 Unraveling Pt. 2, 18 Cognitohazard, 19 Vol. 6.
 */
const WIKI = "https://mandela-catalogue.fandom.com/wiki/";

export type SeedTheory = {
  title: string;
  standing: "likely" | "open" | "doubtful";
  claim: string;
  body: string;
  support: string;
  against: string;
  source: string;
  tapes: number[];
};

export const THEORIES: SeedTheory[] = [
  {
    title: "The Adam we follow is a stand-in for the real Adam",
    standing: "likely",
    claim: "In 1992, 6 took the baby Adam Murray and left something else in his place. The Adam of 2009 is that replacement, raised without knowing what he is.",
    body: `This is the most discussed theory about the series, and the fan wiki goes as far as giving it a name: a "Sleeper Alternate". It says some Alternates are placed in the cradle of an abducted child and grow up believing they are that person, until something "activates" them. The wiki treats Adam as the example.

The theory explains a lot at once: why 6 acts as though he knows Adam, why Adam does not remember him, why Adam shows no reaction to the toddler stress assessment in his file, and why his body changes in the later tapes. It also explains why Adam is the one who is told to "wake up" and "open your eyes" in *Vol. 2*.`,
    support: `- In *Vol. 4* 6 speaks to Adam about the night he "took him away" and "cradled him in my arms", asks if he remembers that night, then says "your skin is not your own. You're not the real y-" before Sarah's voicemail cuts him off.
- The fan wiki points out that in the long speech at the end of *Vol. 4* 6 talks about "him" (the baby) and "Murray" (the man) as if they were two people.
- The file Evelin reads in *Vol. 4* says the toddler Adam responded to none of the stimuli in the stress assessment, and she is frightened by it.
- In *mandela catalyst* and *Presto* Adam's face and body distort, his actor has said his bones were breaking, and in *Vol. 6* he is shown as a tall changed figure.
- The fan wiki reads "wake up" and "open your eyes" in *Vol. 2* as an attempt to wake a sleeper, and "waking the others" as other sleepers still dormant.`,
    against: `- The series has not said it in plain words, and the sentence in *Vol. 4* is cut off before it says what Adam is.
- The "him" and "Murray" wording is an interpretation of one speech, not a stated fact.
- It is not known what happened to the real Adam. He may have died in 1992, or he may be alive somewhere; the fan wiki says this is unconfirmed.
- It is possible that more than one Alternate uses Adam's appearance. The fan wiki lists that as a possibility.
- Alex Kister has not confirmed the theory.`,
    source: `Fan wiki pages [Sleeper Alternate](${WIKI}Sleeper_Alternate) and [Adam Murray](${WIKI}Adam_Murray), plus the tapes listed.`,
    tapes: [5, 9, 11, 12, 19],
  },
  {
    title: "The Intruder and Gabriel are two beings, not one",
    standing: "open",
    claim: "6 (the Intruder) and the false Gabriel are separate. They work in the same direction, but they are not the same entity wearing two faces.",
    body: `Both figures speak to Adam in *Vol. 2*, both appear in Adam's drawings, and both share a text-to-speech voice, so many viewers assume they are one being. Wikipedia describes 6 as separate from the Alternates and as an ally, while Gabriel is their leader. The question is whether the tapes ever say that the two are linked.`,
    support: `- Alex Kister said that the voice that tells Adam to follow the shepherd and open his eyes in *Vol. 2* is Gabriel's, not 6's. If both were one being the distinction would be pointless.
- In *1_19_09 221a* Adam's drawings put the two side by side as separate figures.
- 6 is described in the sources as not being an Alternate. Gabriel is one.
- The two use different tools: 6 works through television, Gabriel appears in the sky, at windows and on rooftops.`,
    against: `- They share the same text-to-speech voice in *exhibition*, according to the fan wiki. That is a production choice and may not mean anything.
- Both are shown talking to Adam in the same scene in *Vol. 2*, and neither is ever shown arguing with the other.
- 6 appears as Stanley in the credits of *Vol. 4*, so he can take other names and forms. Gabriel is also known as O'Brien. A being that changes names makes "two or one" harder to settle.
- The series has not said whether they are allies, rivals or the same.`,
    source: `Fan wiki pages [The Intruder](${WIKI}The_Intruder), [6](${WIKI}6), and trivia on the pages for *exhibition* and *Vol. 2*; Wikipedia for the "ally" description.`,
    tapes: [4, 5, 9, 13],
  },
  {
    title: "6 is the first man, Adam",
    standing: "open",
    claim: "The Intruder is the original Adam from Genesis, who was replaced by an Alternate after eating the fruit, and who is now obsessed with the Adam who was replaced in 1992.",
    body: `The *Vol. 4* opening retells Genesis and shows Adam waking alone at night, finding a figure under the tree and an apple in the grass. Afterward "Adam" is standing over Eve, who is afraid. We never see what happened to the first Adam. The theory fills the gap with 6.`,
    support: `- We never see what happened to Adam after the apple, only that an Alternate was put in his place.
- The fan wiki says the two have similar facial structures.
- 6's name could refer to the sixth day of creation, on which the first man was made.
- It would explain why 6 is so fixed on Adam Murray and on the Alternate that replaced him: he would be seeing his own story repeated.`,
    against: `- No tape says it. The series calls 6 "an intruder" and never gives him a past.
- The face of 6 comes from a real police sketch that became a meme, and Kister has said so; that makes the "similar facial structure" a coincidence of design more than a clue.
- The number could mean anything, and the series has not explained it.`,
    source: `Fan wiki page [6](${WIKI}6) (speculation section), with the *Vol. 4* opening.`,
    tapes: [9, 5],
  },
  {
    title: "N is Cesar's Alternate",
    standing: "open",
    claim: "The tall, dark Alternate N who confronts Jude in Vol. 5 is the same being that copied Cesar Torres in 1992.",
    body: `Cesar's Alternate and N are both tall and shadowed. The fan wiki lists this as a popular theory, with a decent amount of evidence, though Alex Kister has neither confirmed nor denied it.`,
    support: `- Both are drawn as tall, shadowed figures.
- The bedroom N appears in at the end of the T.H.I.N.K. Principle video is thought to be Mark Heathcliff's bedroom, because the room looks identical. In *Vol. 333* Cesar's fingerprints are found on Mark's bedroom door.
- N is among the images 6 flashes at Adam in *Vol. 2*, together with Mark and Cesar and Cesar's Alternate, which puts them in the same set of pictures.
- Some fans think N was in the corner with Jude when he phones about someone staring from the corner in *Vol. 333*.`,
    against: `- Not confirmed or denied by the creator.
- The fan wiki says an official plush description named N as Nicolas Beringer, the owner of the house in the USDTP file in *Vol. 5*. The wiki does not explain how that fits with N being Cesar's Alternate.
- Others read the bedroom as belonging to Cesar's mother, a concerned friend, or Cesar himself.
- The fan wiki also lists a competing idea that N is the Murray residence Alternate, because the two look alike.`,
    source: `Fan wiki page [N](${WIKI}N) and the Vol. 5 pages.`,
    tapes: [2, 5, 6, 15],
  },
  {
    title: "The Alternate in the Murray house is a Tulpa from Stanley's show",
    standing: "likely",
    claim: "The tall Alternate that hunts Thatcher in Vol. 333 was not copied from anyone. It was imagined into the house by someone watching The Might of the Subconscious.",
    body: `In *Vol. 333* a children's program hosted by a puppet called Stanley tells the viewer to imagine a new friend, think hard, and then "go and find them". The fan wiki calls Alternates made that way "Tulpas" and uses the Murray residence Alternate as its example. The word is borrowed from Tibetan Buddhist practice, where it means a being created by thought.`,
    support: `- The program tells the viewer exactly how to imagine a friend (their voice, face and eye color) and says "your new friend is somewhere in your house".
- Lynn in *Vol. 333* says the baby started crying again at the same time as before although she "unplugged it weeks ago" (the line does not say what), and Jude offers an imaginary friend as the cause.
- The Alternate in the house is an Overdriven shape: pale, long-limbed, barely like any person. A reading: that fits something imagined rather than copied.
- The fan wiki says the program cannot be traced to any production company, and credits in *Vol. 4* give 6's voice as "Stanley".`,
    against: `- Lynn is confused by the idea of an imaginary friend because the baby is far too young. Who actually imagined the Alternate is unknown.
- The fan wiki says it is heavily implied that the baby Adam made it, but that is its own reading.
- "Tulpa" is a fan term. The tapes never use it.
- Another fan wiki entry suggests the Alternate in *exhibition* may be the first Tulpa, which would mean the show is not the only source.`,
    source: `Fan wiki pages [Tulpa](${WIKI}Tulpa) and [The Might of the Subconscious](${WIKI}The_Might_of_the_Subconscious).`,
    tapes: [3, 6, 9],
  },
  {
    title: "Cesar's Alternate is the one that attacked Thatcher",
    standing: "doubtful",
    claim: "The Alternate that went after Ruth Weaver and Thatcher Davis in the Murray house in Vol. 333 is the same one that copied Cesar Torres.",
    body: `Cesar's Alternate is named first in the list of victims in the captions during the attack on Thatcher, which makes it tempting to connect the two. A variant of the idea says the Alternate later went around as Mark Heathcliff, because its face turns into Mark's after Mark fires in the restored *Vol. 1*.`,
    support: `- The captions that appear during the attack list "Cesar Torres", "Ruth Weaver" and "Mark Heathcliff" as victims.
- Both are active in the same weeks of 1992 in the same county.
- In the restored *Vol. 1* the Alternate's face changes into Mark's, which gives it a face to wear afterward.`,
    against: `- The fan wiki says it is unlikely: files show Lynn Murray was alive on September 15, 1992, and the Murray house Alternate appears after the Stanley program, which came after Mark's death.
- The two look different. The Murray house Alternate is long-limbed, pale and not a copy of a known person.
- The names in the captions may only be a list of people it has affected, not proof that it is one entity.`,
    source: `Fan wiki page [The Perpetrator](${WIKI}The_Perpetrator).`,
    tapes: [2, 6],
  },
  {
    title: "The Preacher is Mary Magdalene",
    standing: "open",
    claim: "The tall, nun-like Alternate is what was left of one of the women of the Easter story, after Gabriel whispered to her in the tomb.",
    body: `The Preacher is an Overdriven Assimilation: the broken copy of a real elderly nun. *Interlude* labels the nun photograph "A messenger". The Easter clips show nuns in the roles of Mary Magdalene, Joanna and Martha, and one of them is the only person who speaks with Gabriel.`,
    support: `- In *The Story of Easter* Mary Magdalene speaks with Gabriel in the cave and then disappears with the other nuns.
- At the end of *The Story of Easter* Mary starts whispering after Gabriel speaks to her, and the fan wiki reads her as turning into an Alternate. *Unraveling, Pt. 2* shows her meeting Gabriel in the cave again.
- The fan wiki says Gabriel appears to have the power to turn nuns into Preachers.
- *Interlude* shows an elderly nun beside the Preacher as her human counterpart.`,
    against: `- No tape names the nun. The fan wiki calls the identification a possibility.
- A different idea says the Preacher is the creature left on Noah's ark in *exhibition*, which would make her much older.
- Interlude's nun is an elderly woman, while the Mary Magdalene of the clip is a cartoon figure; the link is symbolic at best.`,
    source: `Fan wiki pages [The Preacher](${WIKI}Preacher) and [The Story of Easter](${WIKI}The_Story_of_Easter).`,
    tapes: [4, 5, 8, 10, 17],
  },
  {
    title: "Adam's drawing of the Preacher is a self-portrait",
    standing: "doubtful",
    claim: "The drawing of the Preacher on the MandelaTECH site is Adam drawing himself, which links him to the Preacher or shows what he will become.",
    body: `The drawing of the Preacher made by Adam has the file name "SLF_PRTRT.png" on the Bythorne Paranormal Society website, which reads like "self portrait". In the last scene of *mandela catalyst*, fans noticed Adam and the Preacher look alike.`,
    support: `- The file name reads as "self portrait".
- Adam and the Preacher resemble one another in the last scene of *mandela catalyst*.
- A reading: Adam's changes in the later tapes are of the same kind as the Overdriven look of the Preacher.`,
    against: `- The fan wiki records that a note which said the two were one and the same came from a miscommunication between the two Alexes working on the series, and was removed minutes later.
- Alex Kaizo still reads it as a self-portrait, but "in a less literal way".
- Taken literally, it would make Adam and the Preacher the same being, which no tape states. In *mandela catalyst* the Preacher mimics Adam's voice as though she were someone else.`,
    source: `Fan wiki pages [Adam Murray](${WIKI}Adam_Murray) and [The Preacher](${WIKI}Preacher).`,
    tapes: [9, 11, 13],
  },
  {
    title: "Gabriel meant Jude to die, not Lynn",
    standing: "open",
    claim: "The line \"It was supposed to be you\" means that the person Gabriel meant to destroy on the night of Lynn's death was Jude, and Lynn's death was a mistake.",
    body: `In *Vol. 5* Jude hears the words \"It was supposed to be you\", then sees them on his television in red. The fan wiki reads that as the plan going wrong, and adds that Lynn's death by hanging matches the way the biblical Judas died.`,
    support: `- A blurred Gabriel says it to Jude while he lies in bed, and it then appears on his television.
- Jude's name is the name of Judas, who is said to have hanged himself.
- In the finale N shows Jude visions of himself hanging.`,
    against: `- The tape does not say what \"it\" refers to.
- It does not say that Lynn's death was a mistake. In *intruder alert* 6 is shown with the child and the television, not with Jude.
- Jude's fate is not shown. The fan wiki thinks he probably died of an overdose of Timoril, but some fans think he lived.
- The name link is a pattern the fan wiki noticed, not a statement in the tapes.`,
    source: `Fan wiki pages [Jude Murray](${WIKI}Jude_Murray) and the *Vol. 5* page.`,
    tapes: [3, 6, 15],
  },
  {
    title: "Evelin is no longer Evelin",
    standing: "open",
    claim: "Evelin Miller was taken or killed by an Alternate after the police station in Vol. 4, and the Evelin who talks to Sarah in later tapes is a copy.",
    body: `Evelin goes into the empty police station in *Vol. 4*, finds Adam's file, and is then seen with an arm above her head. In *mandela catalyst* the Preacher imitates Adam's voice in her room. By *Presto* she is on the phone with Sarah. What happened in between is not shown.`,
    support: `- Her fate between *Vol. 4*, *mandela catalyst* and *Presto* is not shown at all.
- The Preacher and the Alternates in these tapes imitate the voices and faces of people, so a copy of Evelin would fit the pattern.
- The fan wiki notes that she has not been shown acting differently, but the theory is that a good copy would not.`,
    against: `- Evelin does not seem to act differently from the Evelin we know. Unlike the Adam theory, where the fan wiki sees a change from nice to abusive, nothing marks her.
- In *Presto* she talks to Sarah about her encounter and her history with Adam.
- The fan wiki says it is just as possible that Thatcher caught her at the station, or that nothing happened, although nothing supports either.`,
    source: `Fan wiki page [Evelin Miller](${WIKI}Evelin_Miller).`,
    tapes: [9, 11, 12],
  },
  {
    title: "Face Studio 2 helps Alternates copy people",
    standing: "likely",
    claim: "MandelaTECH's software is a way to collect faces and personal details, so that the Alternates can copy people and spread through the digital era.",
    body: `Face Studio 2 asks for your personal details and three pictures of your face, and then lets the program make that face say anything. The fan wiki reads that as exactly what an impersonator needs, and notes that the new version can store many faces and send them to a database. At the end of *Vol. 4*, three pictures of Adam appear in the same arrangement as the program asks for.`,
    support: `- It requires the same data an impersonation would need: a face from three angles and personal details.
- The ad calls digital technology the thing that has "come and saved us all" and tells the user to spread the word to friends and family.
- The software was made by MandelaTECH, whose owner Dave Lee was being steered by "O'Brien", who is Gabriel.
- In *Vol. 4* the program glitches into footage of the Murray house and Lynn's body, and the head speaks broken sentences.`,
    against: `- Nothing states that the program does anything beyond what the ad says.
- The fan wiki also notes that Adam seems to have used it to look for information, according to a short chat in *Vol. 4*.
- The glitched footage is connected to Thatcher (the footage is from his body camera), not to a person who used the program.`,
    source: `Fan wiki page [Face Studio 2](${WIKI}Face_Studio_2).`,
    tapes: [9, 11],
  },
  {
    title: "The USDTP made the \"demonstration\" videos",
    standing: "open",
    claim: "The government department that put out the Alternate warnings also produced or collected the M.A.D. videos, including the one in Cognitohazard.",
    body: `Several tapes look like official material: the broadcast in *Vol. 1*, the announcements in *exhibition* and *Interlude*, and the operation file in *Vol. 5*. The description of *Cognitohazard* names itself as "Metaphysical Awareness Disorder Demonstration # A567", extracted from a YouTube file.`,
    support: `- The wording \"Demonstration # A567\" reads like a catalogue number kept by an institution.
- The restored *Vol. 1* puts the M.A.D. explainer on the same compilation as the USDTP broadcast.
- The department kept watch on the county in the 1990s, as *Vol. 5* shows.`,
    against: `- The description is the only evidence, and the department is not named in it.
- Any in-world archivist, or even an Alternate, could have written the label.
- The USDTP's announcements are also shown to be unreliable (for example the claim in *Interlude* that a threat has been dealt with).`,
    source: `Fan wiki page [Cognitohazard](${WIKI}Cognitohazard), which notes the description and suggests the USDTP.`,
    tapes: [2, 8, 15, 18],
  },
  {
    title: "The two Unraveling tapes are one story",
    standing: "likely",
    claim: "The TikTok channel in Part 1 and Dave Lee's tape experiment in Part 2 show the same event from two sides, and both end in the same phrase.",
    body: `Part 1 follows a channel called alldarkallgone, and ends with the girl missing and an Alternate in her mirror. Part 2 follows Dave Lee's experiment with the Easter tape, and ends with the words "ALL GREY ALL DARK ALL GONE" over the footage.`,
    support: `- The phrase repeats in both tapes with only a word added.
- The fan wiki notes the girl's bedroom resembles Mark Heathcliff's, as if her fate follows his.
- Both are about a recording that changes each time it is replayed, and both end with an Alternate near the camera.`,
    against: `- The tapes do not say they are connected, and the fan wiki phrases the link as possible.
- Whether the bedroom copies Mark's on purpose has not been confirmed.
- The tapes are separated in time by an unknown amount.`,
    source: `Fan wiki pages [Unraveling, Pt. 1](${WIKI}Unraveling,_Pt._1) and [Unraveling, Pt. 2](${WIKI}Unraveling,_Pt._2).`,
    tapes: [16, 17],
  },
];
