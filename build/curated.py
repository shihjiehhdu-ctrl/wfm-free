# 每週詞素表：詞素, 錨點詞, 延伸目標詞, 陷阱字／說明
# 字串中以空白分隔；配對用 a>b 表示（a 為已知基底，b 為衍生字）
W = {}

W[1] = ("詞素概念與複合字", [
 ("複合字（自由詞素＋自由詞素）",
  "classroom homework birthday bedroom airport supermarket postcard",
  "breakthrough outcome input overall",
  "butterfly（不是 butter＋fly 的字面義）"),
])

W[2] = ("否定與反轉字首", [
 ("un-（不、反轉）",
  "unhappy able>unable kind>unkind fair>unfair usual>unusual",
  "familiar>unfamiliar expect>unexpected unemployment uncover unlock unfold unveil",
  "uncle uniform until understand"),
 ("in- / im- / il- / ir-（不）",
  "impolite impossible independent correct>incorrect",
  "accurate>inaccurate legal>illegal regular>irregular responsible>irresponsible incredible infinite injustice indispensable",
  "important insect interest；另有「in = 進入」：income indoor import；invaluable＝非常珍貴（不是「無價值」）"),
 ("dis-（不、相反、分開）",
  "disappear dishonest discover",
  "disagree dislike disadvantage disability discourage disappoint disapprove disconnect discomfort disbelief",
  "discuss distance distant"),
 ("mis-（錯誤）／ non-（非）",
  "mistake",
  "misunderstand mislead misfortune nonsense nonprofit",
  "miss missile（mis- 只是拼字巧合）"),
])

W[3] = ("時間與次序字首", [
 ("re-（再、回）",
  "return review recycle recover",
  "renew restore reunion recall refund repay refresh reproduce reassure",
  "really ready reason restaurant regular reach"),
 ("pre-（之前）",
  "prepare",
  "preview prehistoric premature precaution predict",
  "pretty pressure president（pre＋side「坐在前面」，語意已漂移）"),
 ("post-（之後）／ fore-（之前）",
  "",
  "postpone forecast",
  "postcard（post＝郵件，不是「之後」）foreign foreigner"),
 ("ex-（向外）",
  "exit express",
  "export exchange expand extend exclude exclaim extract",
  "excellent expensive exercise exciting"),
])

W[4] = ("位置與程度字首", [
 ("inter-（之間、相互）",
  "internet interview international",
  "interact interaction intermediate interfere intersection",
  "interest interesting"),
 ("sub-（下）／ super-（上、超）",
  "subway supermarket",
  "submarine suburban submit supervise superior superficial",
  "subject（半透明，W11 再處理）"),
 ("trans-（跨越）",
  "",
  "transport transportation translate transform transmit transparent transplant",
  "（基本字詞中沒有 trans- 字，用 bus、train 的 transportation 切入）"),
 ("over- / under-（過度／不足、上／下）",
  "underline underwear overpass underpass",
  "overcome overlook overnight overall overwhelm underestimate undermine undertake undergraduate",
  "understand（字面是「站在下面」，語意已漂移）"),
])

W[5] = ("名詞字尾①", [
 ("-tion / -sion",
  "act>action decide>decision invite>invitation direct>direction discuss>discussion pollute>pollution",
  "collect>collection prepare>preparation expect>expectation imagine>imagination protect>protection invent>invention investigate>investigation communicate>communication contribute>contribution distribute>distribution evaluate>evaluation",
  "station mansion question（不是由 state、man、quest 衍生）"),
 ("-ment",
  "move>movement develop>development improve>improvement agree>agreement",
  "enjoy>enjoyment pay>payment treat>treatment achieve>achievement require>requirement establish>establishment invest>investment involve>involvement commit>commitment assess>assessment",
  "comment apartment department（不能拆成 come、apart、depart 的意思）"),
 ("-ness",
  "happy>happiness kind>kindness dark>darkness weak>weakness",
  "ill>illness aware>awareness conscious>consciousness effective>effectiveness",
  "business（busy＋ness，語意已漂移）"),
])

W[6] = ("名詞字尾②", [
 ("-ity",
  "active>activity",
  "possible>possibility popular>popularity real>reality equal>equality major>majority minor>minority personal>personality responsible>responsibility similar>similarity creative>creativity diverse>diversity complex>complexity secure>security priority",
  "university（不是 universe 的「性質」）city"),
 ("-ance / -ence",
  "different>difference important>importance distant>distance silent>silence",
  "appear>appearance convenient>convenience absent>absence confident>confidence exist>existence independent>independence patient>patience evident>evidence significant>significance frequent>frequency efficient>efficiency consequence reference",
  "finance（不是 fine＋ance）"),
 ("-er / -or / -ist（人、工具）",
  "teach>teacher write>writer sing>singer visit>visitor act>actor art>artist engine>engineer",
  "survive>survivor invent>inventor design>designer produce>producer edit>editor consume>consumer instruct>instructor research>researcher special>specialist observe>observer supervise>supervisor",
  "corner butter mother summer letter flower center（看起來有 -er，其實不能拆）"),
])

W[7] = ("形容詞字尾", [
 ("-al",
  "nature>natural nation>national person>personal tradition>traditional",
  "culture>cultural education>educational emotion>emotional environment>environmental arrive>arrival practice>practical origin>original industry>industrial region>regional function>functional profession>professional critic>critical",
  "several final（不是 sever、fin＋al）；arrival 是名詞"),
 ("-ive",
  "act>active talk>talkative expensive",
  "create>creative express>expressive imagine>imaginative protect>protective effect>effective attract>attractive compete>competitive product>productive construct>constructive alternative represent>representative",
  "forgive（不是 forge＋ive）"),
 ("-ous",
  "danger>dangerous humor>humorous famous nervous",
  "mountain>mountainous courage>courageous poison>poisonous continue>continuous mystery>mysterious luxury>luxurious various",
  "curious（不是 cure＋ous）"),
 ("-ful / -less",
  "care>careful care>careless help>helpful use>useful color>colorful peace>peaceful",
  "power>powerful hope>hopeful meaning>meaningful respect>respectful harm>harmful faithful home>homeless end>endless regardless",
  "priceless＝非常珍貴（不是「沒價值」）"),
 ("-able / -ible",
  "comfortable valuable",
  "enjoy>enjoyable reason>reasonable notice>noticeable accept>acceptable consider>considerable suit>suitable reliable profitable remarkable sustainable accessible portable",
  "sensible ≠ sensitive；responsible（不是 response＋ible 的「能被回應」）"),
])

W[8] = ("動詞與副詞字尾", [
 ("-ize",
  "real>realize",
  "modern>modernize special>specialize character>characterize symbol>symbolize criticize civilize",
  "size prize（只是拼字巧合）"),
 ("-ify",
  "",
  "class>classify simple>simplify just>justify pure>purify intense>intensify diverse>diversify modify",
  "（基本字詞中沒有 -ify 動詞，從 class>classify 切入）"),
 ("-en（動詞）／ en-（使…）",
  "wide>widen short>shorten deep>deepen weak>weaken frighten",
  "strength>strengthen length>lengthen threaten tighten loosen broaden large>enlarge rich>enrich enable",
  "listen kitten dozen；golden、wooden 的 -en 是形容詞"),
 ("-ate",
  "celebrate create decorate appreciate",
  "motive>motivate origin>originate fortune>fortunate passion>passionate",
  "considerate 是形容詞（體貼），不是 consider 的動詞形"),
 ("-ly（副詞）",
  "usually really finally actually especially",
  "significant>significantly consequent>consequently approximate>approximately relative>relatively primary>primarily eventual>eventually",
  "friendly lovely likely 是形容詞"),
])

W[9] = ("拼字與重音變化", [
 ("拼字變化",
  "decide>decision able>ability explain>explanation describe>description high>height",
  "pronounce>pronunciation admit>admission reduce>reduction compete>competition deep>depth wide>width long>length strong>strength",
  "pronunciation 不寫成 pronounciation"),
 ("母音與重音變化",
  "nation>national nature>natural",
  "photograph>photography>photographic history>historical origin>original personal>personality equal>equality economy>economic",
  "nation /eɪ/ → national /æ/；PHOtograph → phoTOgraphy → photoGRAPHic"),
])

W[10] = ("詞性轉換句子練習", [
 ("形容詞 → 名詞",
  "It is important. → its importance",
  "It is possible. → the possibility；They are similar. → the similarity",
  ""),
 ("動詞 → 名詞",
  "They decided. → their decision；It developed. → its development",
  "People agree. → the agreement；They invested. → their investment",
  ""),
])

W[11] = ("移動家族", [
 ("port（搬運）",
  "airport report support",
  "export import transport transportation portable porter portfolio",
  "important opportunity（半透明）；portion portrait（不同字根）"),
 ("mit / mis（送出）",
  "promise",
  "admit permit permission mission commit commitment admission dismiss submit transmit emission",
  "miss limit summit vomit imitate"),
 ("duc / duct（引導）",
  "introduce produce production education",
  "reduce reduction product productive conduct conductor reproduce induce deduct",
  "duck"),
 ("ject（丟）",
  "subject object project reject",
  "inject injection objection objective rejection projection subjective",
  ""),
])

W[12] = ("感知與表達家族", [
 ("spec / spect（看）",
  "special especially respect",
  "inspect inspector suspect aspect perspective spectator prospect spectacular specific species specimen",
  "spice spicy（不同字源）"),
 ("vis / vid（看）",
  "television video visit visitor revise",
  "visible vision visual evident evidence supervise revision envision provision",
  "divide individual（dividere「分」）；vivid（vivus「活」）"),
 ("dict（說）",
  "dictionary",
  "predict prediction contradict contradiction verdict dictate dictator addict",
  ""),
 ("scrib / script（寫）",
  "describe",
  "description descriptive prescribe prescription script manuscript subscribe subscription transcript",
  ""),
 ("aud（聽）",
  "",
  "audience audio auditorium audit",
  "fraud applaud（只是拼字巧合）；基本字詞中沒有 aud 字"),
])

W[13] = ("建造與製作家族", [
 ("struct（建造）",
  "",
  "structure structural construct construction constructive instruct instruction instructor destruction destructive infrastructure",
  "（基本字詞中沒有 struct 字，從 destroy 的反義切入）"),
 ("fac / fect / fic（做）",
  "fact factory perfect affect difficult",
  "effect effective factor manufacture efficient sufficient satisfaction facility artificial infection facilitate defect",
  "face facial surface（不同字根）；fiction（fingere「塑造」）"),
 ("form（形狀）",
  "form uniform information platform",
  "inform perform performance reform formation formula transform conform format formulate",
  "former（來自 fore，不是 form）"),
 ("tract（拉）",
  "contract",
  "attract attractive attraction subtract abstract distract distraction extract contractor",
  ""),
])

W[14] = ("希臘科學詞素", [
 ("bio（生命）／ geo（地）",
  "biology geography",
  "biography autobiography biological antibiotic geometry geographical",
  "pigeon courageous gorgeous surgeon dubious（只是拼字巧合）"),
 ("graph / gram（寫、畫）",
  "program kilogram geography",
  "photograph photography graph paragraph diagram biography autograph graphic telegraph grammar calligraphy",
  ""),
 ("logy / log（學問、話語）",
  "biology apologize",
  "technology psychology ecology ideology sociology archaeology logic logical dialogue analogy",
  "slogan；kilogram（是 gram 不是 log）"),
 ("micro（小）／ tele（遠）／ phon（聲音）",
  "microwave telephone television cellphone",
  "microphone microscope telescope telegraph telecommunications earphone headphones symphony",
  ""),
])

W[15] = ("語意漂移與透明度", [
 ("透明度光譜",
  "understand discuss important president",
  "prevent produce opportunity invaluable priceless",
  "prevent：pre＋vent「先來」→「阻止」；understand：「站在下面」→「理解」"),
])

W[16] = ("自然科學文本", [
 ("多詞素整合字",
  "",
  "biological microscope reproduction transformation structural constructive",
  ""),
])

W[17] = ("社會科文本", [
 ("多詞素整合字",
  "international",
  "transportation perspective disappointment irresponsible misunderstanding unpredictable",
  ""),
])
