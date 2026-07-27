grammar Schedule;

document
  : statement (SEMI statement)* SEMI? EOF
  ;

statement
  : dateRange timeRange timeZone? frequency? byClause?
  ;

dateRange
  : dateValue (DASH dateValue)?
  ;

dateValue
  : TODAY
  | TOMORROW
  | integerDate
  ;

integerDate
  : INTEGER (SLASH INTEGER (SLASH INTEGER)?)?
  ;

timeRange
  : timeValue (DASH (timeValue | timeDuration))?
  | timeDuration
  ;

timeValue
  : NOW
  | START_OF_DAY
  | END_OF_DAY
  | TIME_SEPARATOR
  | QUESTION (TIME_SEPARATOR QUESTION?)?
  | INTEGER (TIME_SEPARATOR (INTEGER | QUESTION)?)?
  ;

timeDuration
  : DURATION
  ;

timeZone
  : IANA_ZONE
  | ZONE_ALIAS
  ;

frequency
  : FREQUENCY (COMMA frequencyOption)*
  ;

frequencyOption
  : INTERVAL_OPTION
  | COUNT_OPTION
  ;

byClause
  : BY LBRACK byItem (COMMA byItem)* RBRACK
  ;

byItem
  : BY_TYPE LBRACK signedInteger (COMMA signedInteger)* RBRACK
  ;

signedInteger
  : DASH? INTEGER
  ;

TODAY: 'tdy';
TOMORROW: 'tmr';
NOW: 'now';
START_OF_DAY: 'start' | 's';
END_OF_DAY: 'end' | 'e';
FREQUENCY: 'daily' | 'weekly' | 'monthly' | 'yearly';
BY: 'by';
BY_TYPE: 'month' | 'weekno' | 'yearday' | 'monthday' | 'day' | 'setpos';
IANA_ZONE: [A-Za-z_] [A-Za-z0-9_+-]* ('/' [A-Za-z0-9_+-]+)+;
INTERVAL_OPTION: 'i' [0-9]+;
COUNT_OPTION: 'c' [0-9]+;
DURATION: [0-9]+ [hm];
ZONE_ALIAS: [A-Za-z] [A-Za-z0-9_]*;
INTEGER: [0-9]+;
QUESTION: '?';
SLASH: '/';
DASH: '-';
TIME_SEPARATOR: ':' | '.';
COMMA: ',';
SEMI: ';';
LBRACK: '[';
RBRACK: ']';
WS: [ \t\r\n]+ -> skip;
