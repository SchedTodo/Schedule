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
  | START_OF_DAY_SHORT
  | END_OF_DAY
  | END_OF_DAY_SHORT
  | timeSeparator
  | QUESTION (timeSeparator QUESTION?)?
  | INTEGER (timeSeparator (INTEGER | QUESTION)?)?
  ;

timeDuration
  : DURATION
  ;

timeZone
  : IANA_ZONE
  | UTC
  | ZONE_ALIAS
  ;

frequency
  : frequencyUnit (COMMA frequencyOption)*
  ;

frequencyUnit
  : DAILY
  | WEEKLY
  | MONTHLY
  | YEARLY
  ;

frequencyOption
  : INTERVAL_OPTION
  | COUNT_OPTION
  ;

byClause
  : BY LBRACK byItem (COMMA byItem)* RBRACK
  ;

byItem
  : byType LBRACK signedInteger (COMMA signedInteger)* RBRACK
  ;

byType
  : MONTH
  | WEEKNO
  | YEARDAY
  | MONTHDAY
  | DAY
  | SETPOS
  ;

signedInteger
  : DASH? INTEGER
  ;

timeSeparator
  : COLON
  | DOT
  ;

TODAY: 'tdy';
TOMORROW: 'tmr';
NOW: 'now';
START_OF_DAY: 'start';
START_OF_DAY_SHORT: 's';
END_OF_DAY: 'end';
END_OF_DAY_SHORT: 'e';
DAILY: 'daily';
WEEKLY: 'weekly';
MONTHLY: 'monthly';
YEARLY: 'yearly';
BY: 'by';
MONTH: 'month';
WEEKNO: 'weekno';
YEARDAY: 'yearday';
MONTHDAY: 'monthday';
DAY: 'day';
SETPOS: 'setpos';
UTC: 'UTC';
IANA_ZONE: [A-Za-z_] [A-Za-z0-9_+-]* ('/' [A-Za-z0-9_+-]+)+;
INTERVAL_OPTION: 'i' [0-9]+;
COUNT_OPTION: 'c' [0-9]+;
DURATION: [0-9]+ [hm];
ZONE_ALIAS: [A-Za-z] [A-Za-z0-9_]*;
INTEGER: [0-9]+;
QUESTION: '?';
SLASH: '/';
DASH: '-';
COLON: ':';
DOT: '.';
COMMA: ',';
SEMI: ';';
LBRACK: '[';
RBRACK: ']';
WS: [ \t\r\n]+ -> skip;
