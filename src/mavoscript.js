(function($, val, $u) {

var _ = Mavo.Script = {
	addUnaryOperator: function(name, o) {
		if (o.symbol) {
			// Build map of symbols to function names for easy rewriting
			Mavo.toArray(o.symbol).forEach(symbol => {
				Mavo.Script.unarySymbols[symbol] = name;
				jsep.addUnaryOp(symbol);
			});
		}

		return Mavo.Functions[name] = operand => _.unaryOperation(operand, operand => o.scalar(val(operand)));
	},

	unaryOperation: function(operand, scalar) {
		if (Array.isArray(operand)) {
			return operand.map(scalar);
		}
		else {
			return scalar(operand);
		}
	},

	binaryOperation: function(a, b, o = {}) {
		if (Array.isArray(b)) {
			if (Array.isArray(a)) {
				result = [
					...b.map((n, i) => o.scalar(a[i] === undefined? o.identity : a[i], n)),
					...a.slice(b.length)
				];
			}
			else {
				result = b.map(n => o.scalar(a, n));
			}
		}
		else if (Array.isArray(a)) {
			result = a.map(n => o.scalar(n, b));
		}
		else {
			result = o.scalar(a, b);
		}

		return result;
	},

	/**
	 * Extend a scalar operator to arrays, or arrays and scalars
	 * The operation between arrays is applied element-wise.
	 * The operation operation between a scalar and an array will result in
	 * the operation being applied between the scalar and every array element.
	 */
	addBinaryOperator: function(name, o) {
		if (o.symbol) {
			// Build map of symbols to function names for easy rewriting
			Mavo.toArray(o.symbol).forEach(symbol => {
				Mavo.Script.symbols[symbol] = name;

				if (o.precedence) {
					jsep.addBinaryOp(symbol, o.precedence);
				}
			});
		}

		o.identity = o.identity === undefined? 0 : o.identity;

		return Mavo.Functions[name] = o.code || function(...operands) {
			if (operands.length === 1) {
				if (Array.isArray(operands[0])) {
					// Operand is an array of operands, expand it out
					operands = [...operands[0]];
				}
			}

			if (!o.raw) {
				operands = operands.map(val);
			}

			var prev = o.logical? o.identity : operands[0], result;

			for (let i = 1; i < operands.length; i++) {
				let a = o.logical? operands[i - 1] : prev;
				let b = operands[i];

				if (Array.isArray(b) && typeof o.identity == "number") {
					b = $u.numbers(b);
				}

				result = _.binaryOperation(a, b, o);

				if (o.reduce) {
					prev = o.reduce(prev, result, a, b);
				}
				else if (o.logical) {
					prev = prev && result;
				}
				else {
					prev = result;
				}
			}

			return prev;
		};
	},

	/**
	 * Mapping of operator symbols to function name.
	 * Populated via addOperator() and addLogicalOperator()
	 */
	symbols: {},
	unarySymbols: {},

	getOperatorName: (op, unary) => Mavo.Script[unary? "unarySymbols" : "symbols"][op] || op,

	/**
	 * Operations for elements and scalars.
	 * Operations between arrays happen element-wise.
	 * Operations between a scalar and an array will result in the operation being performed between the scalar and every array element.
	 * Ordered by precedence (higher to lower)
	 * @param scalar {Function} The operation between two scalars
	 * @param identity The operation’s identity element. Defaults to 0.
	 */
	operators: {
		"not": {
			symbol: "!",
			scalar: a => !a
		},
		"multiply": {
			scalar: (a, b) => a * b,
			identity: 1,
			symbol: "*"
		},
		"divide": {
			scalar: (a, b) => a / b,
			identity: 1,
			symbol: "/"
		},
		"addition": {
			scalar: (a, b) => +a + +b,
			symbol: "+"
		},
		"plus": {
			scalar: a => +a,
			symbol: "+"
		},
		"subtract": {
			scalar: (a, b) => {
				if (isNaN(a) || isNaN(b)) {
					// Handle dates
					var dateA = $u.date(a), dateB = $u.date(b);

					if (dateA && dateB) {
						return dateA - dateB;
					}
				}

				return a - b;
			},
			symbol: "-"
		},
		"minus": {
			scalar: a => -a,
			symbol: "-"
		},
		"mod": {
			scalar: (a, b) => {
				var ret = a % b;
				ret += ret < 0? b : 0;
				return ret;
			},
			symbol: "mod",
			precedence: 6
		},
		"lte": {
			logical: true,
			scalar: (a, b) => {
				[a, b] = Mavo.Script.getNumericalOperands(a, b);
				return a <= b;
			},
			identity: true,
			symbol: "<="
		},
		"lt": {
			logical: true,
			scalar: (a, b) => {
				[a, b] = Mavo.Script.getNumericalOperands(a, b);
				return a < b;
			},
			identity: true,
			symbol: "<"
		},
		"gte": {
			logical: true,
			scalar: (a, b) => {
				[a, b] = Mavo.Script.getNumericalOperands(a, b);
				return a >= b;
			},
			identity: true,
			symbol: ">="
		},
		"gt": {
			logical: true,
			scalar: (a, b) => {
				[a, b] = Mavo.Script.getNumericalOperands(a, b);
				return a > b;
			},
			identity: true,
			symbol: ">"
		},
		"eq": {
			logical: true,
			scalar: (a, b) => a == b,
			symbol: ["=", "=="],
			identity: true,
			precedence: 6
		},
		"neq": {
			logical: true,
			scalar: (a, b) => a != b,
			symbol: ["!="],
			identity: true
		},
		"and": {
			logical: true,
			scalar: (a, b) => !!a && !!b,
			identity: true,
			symbol: ["&&", "and"],
			precedence: 2
		},
		"or": {
			logical: true,
			scalar: (a, b) => a || b,
			reduce: (p, r) => p || r,
			identity: false,
			symbol: ["||", "or"],
			precedence: 2
		},
		"concatenate": {
			symbol: "&",
			identity: "",
			scalar: (a, b) => "" + (a || "") + (b || ""),
			precedence: 10
		},
		"object": {
			symbol: ":",
			code: (...operands) => {
				var i = operands.length - 1;
				var value = operands[i];

				while (i--) {
					value = {[operands[i]]: value};
				}

				return value;
			},
			transformation: node => {
				if (node.left.type == "Identifier") {
					node.left = {
						type: "Literal",
						value: node.left.name,
						raw: JSON.stringify(node.left.name)
					};
				}
			},
			precedence: 4
		},
		"filter": {
			symbol: "where",
			scalar: (a, b) => val(b)? a : null,
			raw: true,
			precedence: 2
		}
	},

	getNumericalOperands: function(a, b) {
		if (isNaN(a) || isNaN(b)) {
			// Try comparing as dates
			var da = $u.date(a), db = $u.date(b);

			if (da && db) {
				// Both valid dates
				return [da, db];
			}
		}

		return [a, b];
	},

	/**
	 * These serializers transform the AST into JS
	 */
	serializers: {
		"BinaryExpression": node => `${_.serialize(node.left)} ${node.operator} ${_.serialize(node.right)}`,
		"UnaryExpression": node => `${node.operator}${_.serialize(node.argument)}`,
		"CallExpression": node => `${_.serialize(node.callee)}(${node.arguments.map(_.serialize).join(", ")})`,
		"ConditionalExpression": node => `${_.serialize(node.test)}? ${_.serialize(node.consequent)} : ${_.serialize(node.alternate)}`,
		"MemberExpression": node => {
			var property = node.computed? _.serialize(node.property) : `"${node.property.name}"`;
			return `get(${_.serialize(node.object)}, ${property})`;
		},
		"ArrayExpression": node => `[${node.elements.map(_.serialize).join(", ")}]`,
		"Literal": node => node.raw,
		"Identifier": node => node.name,
		"ThisExpression": node => "this",
		"Compound": node => node.body.map(_.serialize).join(", ")
	},

	/**
	 * These are run before the serializers and transform the expression to support MavoScript
	 */
	transformations: {
		"BinaryExpression": node => {
			let name = Mavo.Script.getOperatorName(node.operator);
			let def = _.operators[name];

			if (def.transformation) {
				def.transformation(node);
			}

			var nodeLeft = node;
			var args = [];

			// Flatten same operator calls
			do {
				args.unshift(nodeLeft.right);
				nodeLeft = nodeLeft.left;
			} while (Mavo.Script.getOperatorName(nodeLeft.operator) === name);

			args.unshift(nodeLeft);

			if (args.length > 1) {
				return `${name}(${args.map(_.serialize).join(", ")})`;
			}
		},
		"UnaryExpression": node => {
			var name = Mavo.Script.getOperatorName(node.operator, true);

			if (name) {
				return `${name}(${_.serialize(node.argument)})`;
			}
		},
		"CallExpression": node => {
			if (node.callee.type == "Identifier") {
				if (node.callee.name == "if") {
					node.callee.name = "iff";
				}
				else if (node.callee.name == "delete") {
					node.callee.name = "clear";
				}

				if (node.callee.name in Mavo.Functions) {
					node.callee.name = "Mavo.Functions._Trap." + node.callee.name;
				}
			}
		}
	},

	serialize: node => {
		var ret = _.transformations[node.type] && _.transformations[node.type](node);

		if (ret !== undefined) {
			return ret;
		}

		return _.serializers[node.type](node);
	},

	rewrite: function(code) {
		try {
			return _.serialize(_.parse(code));
		}
		catch (e) {
			// Parsing as MavoScript failed, falling back to plain JS
			return code;
		}
	},

	compile: function(code, extraContext) {
		code = _.rewrite(code);

		code = `with (data || {}) {
			return (${code});
		}`;

		if (extraContext) {
			code = `	with (${extraContext}) {
		${code}
	}`;
		}

		return new Function("data", `with(Mavo.Functions._Trap)
${code}`);
	},

	parse: self.jsep,
};

_.serializers.LogicalExpression = _.serializers.BinaryExpression;
_.transformations.LogicalExpression = _.transformations.BinaryExpression;

for (let name in Mavo.Script.operators) {
	let details = Mavo.Script.operators[name];

	if (details.scalar && details.scalar.length < 2) {
		Mavo.Script.addUnaryOperator(name, details);
	}
	else {
		Mavo.Script.addBinaryOperator(name, details);
	}
}

var aliases = {
	average: "avg",
	iff: "iff IF",
	multiply: "mult product",
	divide: "div",
	lt: "smaller",
	gt: "larger bigger",
	eq: "equal equality",
	ordinal: "th"
};

for (let name in aliases) {
	aliases[name].split(/\s+/g).forEach(alias => Mavo.Functions[alias] = Mavo.Functions[name]);
}

})(Bliss, Mavo.value, Mavo.Functions.util);
