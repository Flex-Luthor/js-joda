/**
 * @copyright (c) 2016, Philipp Thuerwaechter & Pattrick Hueper
 * @copyright (c) 2007-present, Stephen Colebourne & Michael Nascimento Santos
 * @license BSD-3-Clause (see LICENSE in the root directory of this source tree)
 */

import {assert} from '../assert';
import {ArithmeticException} from '../errors';

import {SignStyle} from './SignStyle';

export class DateTimeFormatterBuilder{

}

const EXCEED_POINTS = [
    0,
    10,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    100000000,
    1000000000
];

const MAX_WIDTH = 15; // can't parse all numbers with more then 15 digits in javascript

class NumberPrinterParser {

    /**
     * Constructor.
     *
     * @param field  the field to print, not null
     * @param minWidth  the minimum field width, from 1 to 19
     * @param maxWidth  the maximum field width, from minWidth to 19
     * @param signStyle  the positive/negative sign style, not null
     * @param subsequentWidth  the width of subsequent non-negative numbers, 0 or greater,
     *  -1 if fixed width due to active adjacent parsing
     */
    constructor(field, minWidth, maxWidth, signStyle, subsequentWidth=0){
        this._field = field;
        this._minWidth = minWidth;
        this._maxWidth = maxWidth;
        this._signStyle = signStyle;
        this._subsequentWidth = subsequentWidth;
    }

    withSubsequentWidth(subsequentWidth) {
        return new NumberPrinterParser(this._field, this._minWidth, this._maxWidth, this._signStyle, this._subsequentWidth + subsequentWidth);
    }

    _isFixedWidth() {
        return this._subsequentWidth === -1 ||
                (this._subsequentWidth > 0 && this._minWidth === this._maxWidth && this._signStyle === SignStyle.NOT_NEGATIVE);
    }

    parse(context, text, position){
        var length = text.length;
        if (position === length) {
            return ~position;
        }
        assert(position>=0 && position<length);
        var sign = text.charAt(position);  // IOOBE if invalid position
        var negative = false;
        var positive = false;
        if (sign === context.symbols().positiveSign()) {
            if (this._signStyle.parse(true, context.isStrict(), this._minWidth === this._maxWidth) === false) {
                return ~position;
            }
            positive = true;
            position++;
        } else if (sign === context.symbols().negativeSign()) {
            if (this._signStyle.parse(false, context.isStrict(), this._minWidth === this._maxWidth) === false) {
                return ~position;
            }
            negative = true;
            position++;
        } else {
            if (this._signStyle === SignStyle.ALWAYS && context.isStrict()) {
                return ~position;
            }
        }
        var effMinWidth = (context.isStrict() || this._isFixedWidth() ? this._minWidth : 1);
        var minEndPos = position + effMinWidth;
        if (minEndPos > length) {
            return ~position;
        }
        var effMaxWidth = (context.isStrict() || this._isFixedWidth() ? this._maxWidth : 9) + Math.max(this._subsequentWidth, 0);
        var total = 0;
        var pos = position;
        for (let pass = 0; pass < 2; pass++) {
            let maxEndPos = Math.min(pos + effMaxWidth, length);
            while (pos < maxEndPos) {
                let ch = text.charAt(pos++);
                let digit = context.symbols().convertToDigit(ch);
                if (digit < 0) {
                    pos--;
                    if (pos < minEndPos) {
                        return ~position;  // need at least min width digits
                    }
                    break;
                }
                if ((pos - position) > MAX_WIDTH) {
                    throw new ArithmeticException('number text exceeds length');
                } else {
                    total = total * 10 + digit;
                }
            }
            if (this._subsequentWidth > 0 && pass === 0) {
                // re-parse now we know the correct width
                let parseLen = pos - position;
                effMaxWidth = Math.max(effMinWidth, parseLen - this._subsequentWidth);
                pos = position;
                total = 0;
            } else {
                break;
            }
        }
        if (negative) {
            if (total === 0 && context.isStrict()) {
                return ~(position - 1);  // minus zero not allowed
            }
            if(total !== 0) {
                total = -total;
            }
        } else if (this._signStyle === SignStyle.EXCEEDS_PAD && context.isStrict()) {
            let parseLen = pos - position;
            if (positive) {
                if (parseLen <= this._minWidth) {
                    return ~(position - 1);  // '+' only parsed if minWidth exceeded
                }
            } else {
                if (parseLen > this._minWidth) {
                    return ~position;  // '+' must be parsed if minWidth exceeded
                }
            }
        }
        return this._setValue(context, total, position, pos);
    }
    
    /**
     * Stores the value.
     *
     * @param context  the context to store into, not null
     * @param value  the value
     * @param errorPos  the position of the field being parsed
     * @param successPos  the position after the field being parsed
     * @return the new position
     */
    _setValue(context, value, errorPos, successPos) {
        return context.setParsedField(this._field, value, errorPos, successPos);
    }
 
    toString() {
        if (this._minWidth === 1 && this._maxWidth === MAX_WIDTH && this._signStyle === SignStyle.NORMAL) {
            return 'Value(' + this._field + ')';
        }
        if (this._minWidth === this._maxWidth && this._signStyle === SignStyle.NOT_NEGATIVE) {
            return 'Value(' + this._field + ',' + this._minWidth + ')';
        }
        return 'Value(' + this._field + ',' + this._minWidth + ',' + this._maxWidth + ',' + this._signStyle + ')';
    }
    
}

DateTimeFormatterBuilder.NumberPrinterParser = NumberPrinterParser;