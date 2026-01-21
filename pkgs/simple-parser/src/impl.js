// https://github.com/neko-para/SimpleParser

function dump(v) {
  if (typeof v === 'object') {
    if (v instanceof Function) {
      return v
    } else if (v instanceof Array) {
      return v.map(dump)
    } else {
      const r = {}
      for (const k in v) {
        r[k] = v[k]
      }
      return r
    }
  } else {
    return v
  }
}

export default class SimpleParser {
  constructor(lexRule) {
    this.lexRule = lexRule
    this.parseRule = {
      $: [[['%$begin', '$entry', '%$end'], ([, v]) => v]]
    }
    const obj = this.parseRule
    let uid = 0
    const rule = {
      entry(...keys) {
        return rule.for('$entry').when(...keys)
      },
      for(prop = '') {
        if (prop === '') {
          prop = `$${uid++}`
        }
        obj[prop] = obj[prop] || []
        return {
          key: prop,
          pat: {},
          for(p) {
            return rule.for(p)
          },
          with(func) {
            func(this)
            return this
          },
          when(...keys) {
            return {
              do: (f = ([v]) => v) => {
                obj[prop].push([keys, f])
                return this
              },
              withloop() {
                const r = rule.for()
                const rr = rule.for()
                rr.when(r.key)
                  .do(x => x)
                  .when(r.key, rr.key)
                  .do(([x, ys]) => [x, ...ys])
                keys.push(rr.key)
                return {
                  when(...lkeys) {
                    return {
                      do: f => {
                        r.when(...lkeys).do(f)
                        return this
                      }
                    }
                  },
                  do: f => {
                    return this.do(f)
                  }
                }
              }
            }
          },
          sameas(key) {
            obj[prop].push([[key], ([v]) => v])
            return this
          }
        }
      }
    }
    this.rule = rule
  }
  /**
   * @param {string} text
   * @param {RegExp} rule
   */
  canLex(text, rule) {
    const match = rule.exec(text)
    if (match && match.index === 0) {
      return [true, match[0].length]
    } else {
      return [false, -1]
    }
  }
  /**
   * @param {string} text
   */
  *doLex(text) {
    let offset = 0
    let lastOffset = null
    while (text.length > 0) {
      const [r, i] = this.canLex(text, this.lexRule.ignore)
      if (r) {
        text = text.substring(i)
        offset += i
        continue
      }
      for (const [name, rule] of this.lexRule.token) {
        if (
          this.lexRule.tokenFilter?.(`%${name}`, idx => {
            return this.tokens[this.tokens.length - 1 - idx].name ?? null
          })
        ) {
          continue
        }
        const [r, i] = this.canLex(text, rule)
        if (r) {
          yield { name: `%${name}`, value: text.substring(0, i), range: [offset, i] }
          text = text.substring(i)
          offset += i
          break
        }
      }
      if (lastOffset === offset) {
        throw `parse error: lex failed since >>${text.substring(0, 10)}<<`
      }
      lastOffset = offset
    }
  }
  matchGrammar(grammar, gptr, ptr, cache, result) {
    if (grammar.length === gptr) {
      result.push([dump(cache), ptr])
      return
    }
    const [r, v] = this.doParse(grammar[gptr], ptr)
    if (!r) {
      return
    }
    for (const [value, offset] of v) {
      cache.push(value)
      this.matchGrammar(grammar, gptr + 1, ptr + offset, cache, result)
      cache.pop()
    }
  }
  /**
   * @param {string} name
   * @param {number} ptr
   */
  doParse(name, ptr = 0) {
    if (ptr >= this.tokens.length) {
      return [false, []]
    }
    if (name.startsWith('%')) {
      const token = this.tokens[ptr]
      if (token.name === name) {
        return [true, [[{ value: token.value, range: token.range }, 1]]]
      } else {
        return [false, []]
      }
    }
    const opts = this.parseRule[name]
    const result = []
    for (const [grammer, process] of opts) {
      const tmp = []
      this.matchGrammar(grammer, 0, ptr, [], tmp)
      result.push(...tmp.map(([v, p]) => [process(v), p - ptr]))
    }
    return [result.length > 0, result]
  }
  /**
   * @param {string} text
   */
  parse(text) {
    this.tokens = [{ name: '%$begin', range: [0, 0] }]
    for (const token of this.doLex(text)) {
      this.tokens.push(token)
    }
    this.tokens.push({ name: '%$end', range: [text.length, 0] })
    const [state, result] = this.doParse('$')
    if (state && result.length === 1) {
      return result[0][0]
    } else {
      throw `parse error: ${result}`
    }
  }
}
