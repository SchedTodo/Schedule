// Generated from schedule.g4 by ANTLR 4.13.0
// noinspection ES6UnusedImports,JSUnusedGlobalSymbols,JSUnusedLocalSymbols
import {
	ATN,
	ATNDeserializer,
	CharStream,
	DecisionState, DFA,
	Lexer,
	LexerATNSimulator,
	RuleContext,
	PredictionContextCache,
	Token
} from "antlr4";
export default class scheduleLexer extends Lexer {
	public static readonly T__0 = 1;
	public static readonly T__1 = 2;
	public static readonly T__2 = 3;
	public static readonly T__3 = 4;
	public static readonly T__4 = 5;
	public static readonly T__5 = 6;
	public static readonly T__6 = 7;
	public static readonly T__7 = 8;
	public static readonly T__8 = 9;
	public static readonly T__9 = 10;
	public static readonly T__10 = 11;
	public static readonly T__11 = 12;
	public static readonly T__12 = 13;
	public static readonly T__13 = 14;
	public static readonly T__14 = 15;
	public static readonly T__15 = 16;
	public static readonly T__16 = 17;
	public static readonly T__17 = 18;
	public static readonly T__18 = 19;
	public static readonly T__19 = 20;
	public static readonly T__20 = 21;
	public static readonly T__21 = 22;
	public static readonly T__22 = 23;
	public static readonly T__23 = 24;
	public static readonly T__24 = 25;
	public static readonly T__25 = 26;
	public static readonly T__26 = 27;
	public static readonly T__27 = 28;
	public static readonly T__28 = 29;
	public static readonly T__29 = 30;
	public static readonly T__30 = 31;
	public static readonly T__31 = 32;
	public static readonly T__32 = 33;
	public static readonly T__33 = 34;
	public static readonly T__34 = 35;
	public static readonly ID = 36;
	public static readonly ALPHANUM = 37;
	public static readonly DIGIT = 38;
	public static readonly WS = 39;
	public static readonly EOF = Token.EOF;

	public static readonly channelNames: string[] = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	public static readonly literalNames: (string | null)[] = [ null, "'='", 
                                                            "';'", "'('", 
                                                            "')'", "','", 
                                                            "'{'", "'}'", 
                                                            "'string'", 
                                                            "'date'", "'day'", 
                                                            "'time'", "'task'", 
                                                            "'[]'", "'['", 
                                                            "']'", "'\"'", 
                                                            "'\\r'", "'\\n'", 
                                                            "'\\'", "'/'", 
                                                            "':'", "'Mon'", 
                                                            "'Tue'", "'Wed'", 
                                                            "'Thur'", "'Fri'", 
                                                            "'Sat'", "'Sun'", 
                                                            "'-'", "'create'", 
                                                            "'remove'", 
                                                            "'update'", 
                                                            "'delete'", 
                                                            "'select'", 
                                                            "'print'" ];
	public static readonly symbolicNames: (string | null)[] = [ null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             null, null, 
                                                             "ID", "ALPHANUM", 
                                                             "DIGIT", "WS" ];
	public static readonly modeNames: string[] = [ "DEFAULT_MODE", ];

	public static readonly ruleNames: string[] = [
		"T__0", "T__1", "T__2", "T__3", "T__4", "T__5", "T__6", "T__7", "T__8", 
		"T__9", "T__10", "T__11", "T__12", "T__13", "T__14", "T__15", "T__16", 
		"T__17", "T__18", "T__19", "T__20", "T__21", "T__22", "T__23", "T__24", 
		"T__25", "T__26", "T__27", "T__28", "T__29", "T__30", "T__31", "T__32", 
		"T__33", "T__34", "ID", "ALPHANUM", "DIGIT", "WS",
	];


	constructor(input: CharStream) {
		super(input);
		this._interp = new LexerATNSimulator(this, scheduleLexer._ATN, scheduleLexer.DecisionsToDFA, new PredictionContextCache());
	}

	public get grammarFileName(): string { return "schedule.g4"; }

	public get literalNames(): (string | null)[] { return scheduleLexer.literalNames; }
	public get symbolicNames(): (string | null)[] { return scheduleLexer.symbolicNames; }
	public get ruleNames(): string[] { return scheduleLexer.ruleNames; }

	public get serializedATN(): number[] { return scheduleLexer._serializedATN; }

	public get channelNames(): string[] { return scheduleLexer.channelNames; }

	public get modeNames(): string[] { return scheduleLexer.modeNames; }

	public static readonly _serializedATN: number[] = [4,0,39,235,6,-1,2,0,
	7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,6,2,7,7,7,2,8,7,8,2,9,
	7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,2,14,7,14,2,15,7,15,2,16,7,
	16,2,17,7,17,2,18,7,18,2,19,7,19,2,20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,
	2,24,7,24,2,25,7,25,2,26,7,26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,
	31,7,31,2,32,7,32,2,33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,
	7,38,1,0,1,0,1,1,1,1,1,2,1,2,1,3,1,3,1,4,1,4,1,5,1,5,1,6,1,6,1,7,1,7,1,
	7,1,7,1,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,9,1,9,1,9,1,9,1,10,1,10,1,10,1,
	10,1,10,1,11,1,11,1,11,1,11,1,11,1,12,1,12,1,12,1,13,1,13,1,14,1,14,1,15,
	1,15,1,16,1,16,1,17,1,17,1,18,1,18,1,19,1,19,1,20,1,20,1,21,1,21,1,21,1,
	21,1,22,1,22,1,22,1,22,1,23,1,23,1,23,1,23,1,24,1,24,1,24,1,24,1,24,1,25,
	1,25,1,25,1,25,1,26,1,26,1,26,1,26,1,27,1,27,1,27,1,27,1,28,1,28,1,29,1,
	29,1,29,1,29,1,29,1,29,1,29,1,30,1,30,1,30,1,30,1,30,1,30,1,30,1,31,1,31,
	1,31,1,31,1,31,1,31,1,31,1,32,1,32,1,32,1,32,1,32,1,32,1,32,1,33,1,33,1,
	33,1,33,1,33,1,33,1,33,1,34,1,34,1,34,1,34,1,34,1,34,1,35,4,35,212,8,35,
	11,35,12,35,213,1,35,5,35,217,8,35,10,35,12,35,220,9,35,1,36,4,36,223,8,
	36,11,36,12,36,224,1,37,1,37,1,38,4,38,230,8,38,11,38,12,38,231,1,38,1,
	38,0,0,39,1,1,3,2,5,3,7,4,9,5,11,6,13,7,15,8,17,9,19,10,21,11,23,12,25,
	13,27,14,29,15,31,16,33,17,35,18,37,19,39,20,41,21,43,22,45,23,47,24,49,
	25,51,26,53,27,55,28,57,29,59,30,61,31,63,32,65,33,67,34,69,35,71,36,73,
	37,75,38,77,39,1,0,5,3,0,65,90,95,95,97,122,4,0,48,57,65,90,95,95,97,122,
	3,0,48,57,65,90,97,122,1,0,48,57,3,0,9,10,13,13,32,32,238,0,1,1,0,0,0,0,
	3,1,0,0,0,0,5,1,0,0,0,0,7,1,0,0,0,0,9,1,0,0,0,0,11,1,0,0,0,0,13,1,0,0,0,
	0,15,1,0,0,0,0,17,1,0,0,0,0,19,1,0,0,0,0,21,1,0,0,0,0,23,1,0,0,0,0,25,1,
	0,0,0,0,27,1,0,0,0,0,29,1,0,0,0,0,31,1,0,0,0,0,33,1,0,0,0,0,35,1,0,0,0,
	0,37,1,0,0,0,0,39,1,0,0,0,0,41,1,0,0,0,0,43,1,0,0,0,0,45,1,0,0,0,0,47,1,
	0,0,0,0,49,1,0,0,0,0,51,1,0,0,0,0,53,1,0,0,0,0,55,1,0,0,0,0,57,1,0,0,0,
	0,59,1,0,0,0,0,61,1,0,0,0,0,63,1,0,0,0,0,65,1,0,0,0,0,67,1,0,0,0,0,69,1,
	0,0,0,0,71,1,0,0,0,0,73,1,0,0,0,0,75,1,0,0,0,0,77,1,0,0,0,1,79,1,0,0,0,
	3,81,1,0,0,0,5,83,1,0,0,0,7,85,1,0,0,0,9,87,1,0,0,0,11,89,1,0,0,0,13,91,
	1,0,0,0,15,93,1,0,0,0,17,100,1,0,0,0,19,105,1,0,0,0,21,109,1,0,0,0,23,114,
	1,0,0,0,25,119,1,0,0,0,27,122,1,0,0,0,29,124,1,0,0,0,31,126,1,0,0,0,33,
	128,1,0,0,0,35,130,1,0,0,0,37,132,1,0,0,0,39,134,1,0,0,0,41,136,1,0,0,0,
	43,138,1,0,0,0,45,142,1,0,0,0,47,146,1,0,0,0,49,150,1,0,0,0,51,155,1,0,
	0,0,53,159,1,0,0,0,55,163,1,0,0,0,57,167,1,0,0,0,59,169,1,0,0,0,61,176,
	1,0,0,0,63,183,1,0,0,0,65,190,1,0,0,0,67,197,1,0,0,0,69,204,1,0,0,0,71,
	211,1,0,0,0,73,222,1,0,0,0,75,226,1,0,0,0,77,229,1,0,0,0,79,80,5,61,0,0,
	80,2,1,0,0,0,81,82,5,59,0,0,82,4,1,0,0,0,83,84,5,40,0,0,84,6,1,0,0,0,85,
	86,5,41,0,0,86,8,1,0,0,0,87,88,5,44,0,0,88,10,1,0,0,0,89,90,5,123,0,0,90,
	12,1,0,0,0,91,92,5,125,0,0,92,14,1,0,0,0,93,94,5,115,0,0,94,95,5,116,0,
	0,95,96,5,114,0,0,96,97,5,105,0,0,97,98,5,110,0,0,98,99,5,103,0,0,99,16,
	1,0,0,0,100,101,5,100,0,0,101,102,5,97,0,0,102,103,5,116,0,0,103,104,5,
	101,0,0,104,18,1,0,0,0,105,106,5,100,0,0,106,107,5,97,0,0,107,108,5,121,
	0,0,108,20,1,0,0,0,109,110,5,116,0,0,110,111,5,105,0,0,111,112,5,109,0,
	0,112,113,5,101,0,0,113,22,1,0,0,0,114,115,5,116,0,0,115,116,5,97,0,0,116,
	117,5,115,0,0,117,118,5,107,0,0,118,24,1,0,0,0,119,120,5,91,0,0,120,121,
	5,93,0,0,121,26,1,0,0,0,122,123,5,91,0,0,123,28,1,0,0,0,124,125,5,93,0,
	0,125,30,1,0,0,0,126,127,5,34,0,0,127,32,1,0,0,0,128,129,5,13,0,0,129,34,
	1,0,0,0,130,131,5,10,0,0,131,36,1,0,0,0,132,133,5,92,0,0,133,38,1,0,0,0,
	134,135,5,47,0,0,135,40,1,0,0,0,136,137,5,58,0,0,137,42,1,0,0,0,138,139,
	5,77,0,0,139,140,5,111,0,0,140,141,5,110,0,0,141,44,1,0,0,0,142,143,5,84,
	0,0,143,144,5,117,0,0,144,145,5,101,0,0,145,46,1,0,0,0,146,147,5,87,0,0,
	147,148,5,101,0,0,148,149,5,100,0,0,149,48,1,0,0,0,150,151,5,84,0,0,151,
	152,5,104,0,0,152,153,5,117,0,0,153,154,5,114,0,0,154,50,1,0,0,0,155,156,
	5,70,0,0,156,157,5,114,0,0,157,158,5,105,0,0,158,52,1,0,0,0,159,160,5,83,
	0,0,160,161,5,97,0,0,161,162,5,116,0,0,162,54,1,0,0,0,163,164,5,83,0,0,
	164,165,5,117,0,0,165,166,5,110,0,0,166,56,1,0,0,0,167,168,5,45,0,0,168,
	58,1,0,0,0,169,170,5,99,0,0,170,171,5,114,0,0,171,172,5,101,0,0,172,173,
	5,97,0,0,173,174,5,116,0,0,174,175,5,101,0,0,175,60,1,0,0,0,176,177,5,114,
	0,0,177,178,5,101,0,0,178,179,5,109,0,0,179,180,5,111,0,0,180,181,5,118,
	0,0,181,182,5,101,0,0,182,62,1,0,0,0,183,184,5,117,0,0,184,185,5,112,0,
	0,185,186,5,100,0,0,186,187,5,97,0,0,187,188,5,116,0,0,188,189,5,101,0,
	0,189,64,1,0,0,0,190,191,5,100,0,0,191,192,5,101,0,0,192,193,5,108,0,0,
	193,194,5,101,0,0,194,195,5,116,0,0,195,196,5,101,0,0,196,66,1,0,0,0,197,
	198,5,115,0,0,198,199,5,101,0,0,199,200,5,108,0,0,200,201,5,101,0,0,201,
	202,5,99,0,0,202,203,5,116,0,0,203,68,1,0,0,0,204,205,5,112,0,0,205,206,
	5,114,0,0,206,207,5,105,0,0,207,208,5,110,0,0,208,209,5,116,0,0,209,70,
	1,0,0,0,210,212,7,0,0,0,211,210,1,0,0,0,212,213,1,0,0,0,213,211,1,0,0,0,
	213,214,1,0,0,0,214,218,1,0,0,0,215,217,7,1,0,0,216,215,1,0,0,0,217,220,
	1,0,0,0,218,216,1,0,0,0,218,219,1,0,0,0,219,72,1,0,0,0,220,218,1,0,0,0,
	221,223,7,2,0,0,222,221,1,0,0,0,223,224,1,0,0,0,224,222,1,0,0,0,224,225,
	1,0,0,0,225,74,1,0,0,0,226,227,7,3,0,0,227,76,1,0,0,0,228,230,7,4,0,0,229,
	228,1,0,0,0,230,231,1,0,0,0,231,229,1,0,0,0,231,232,1,0,0,0,232,233,1,0,
	0,0,233,234,6,38,0,0,234,78,1,0,0,0,5,0,213,218,224,231,1,6,0,0];

	private static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!scheduleLexer.__ATN) {
			scheduleLexer.__ATN = new ATNDeserializer().deserialize(scheduleLexer._serializedATN);
		}

		return scheduleLexer.__ATN;
	}


	static DecisionsToDFA = scheduleLexer._ATN.decisionToState.map( (ds: DecisionState, index: number) => new DFA(ds, index) );
}