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
  : timeValue (DASH timeValue)?
  ;

timeValue
  : START_OF_DAY
  | END_OF_DAY
  | TIME_SEPARATOR
  | QUESTION (TIME_SEPARATOR QUESTION?)?
  | INTEGER (TIME_SEPARATOR (INTEGER | QUESTION)?)?
  ;

timeZone
  : IANA_ZONE
  | ZONE_ABBR
  ;

frequency
  : FREQUENCY (COMMA frequencyOption)*
  ;

frequencyOption
  : INTERVAL INTEGER
  | COUNT INTEGER
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
START_OF_DAY: 'start' | 's';
END_OF_DAY: 'end' | 'e';
FREQUENCY: 'daily' | 'weekly' | 'monthly' | 'yearly';
BY: 'by';
BY_TYPE: 'month' | 'weekno' | 'yearday' | 'monthday' | 'day' | 'setpos';
INTERVAL: 'i';
COUNT: 'c';
IANA_ZONE: [A-Za-z_] [A-Za-z0-9_+-]* ('/' [A-Za-z0-9_+-]+)+;
ZONE_ABBR: [A-Z] [A-Z] [A-Z] [A-Z]? [A-Z]?;
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
