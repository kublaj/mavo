(function(){

var Super = Wysie.Unit;

var _ = Wysie.Scope = function (element, wysie) {
	var me = this;

	Super.apply(this, arguments);

	this.collections = $$(Wysie.selectors.multiple, element).map(function(template) {
		return new Wysie.Collection(template, me.wysie);
	}, this);

	// Create Wysie objects for all properties in this scope, primitives or scopes, but not properties in descendant scopes
	this.properties.forEach(function(prop){
		prop._.data.unit = Super.create(prop, me.wysie);
	});

	if (this.isRoot) {
		this.element.classList.add("wysie-root");

		// TODO handle element templates in a better/more customizable way
		this.buttons = {
			edit: document.createElement("button")._.set({
				textContent: "✎",
				title: "Edit this " + this.type,
				className: "edit"
			}),
			savecancel: document.createElement("div")._.set({
				className: "wysie-buttons",
				contents: [{
					tag: "button",
					textContent: "Save",
					className: "save",
				}, {
					tag: "button",
					textContent: "Cancel",
					className: "cancel"
				}]
			})
		};

		this.element._.delegate({
			click: {
				"button.edit": this.edit.bind(this),
				"button.save": this.save.bind(this),
				"button.cancel": this.cancel.bind(this)
			},
			keyup: {
				"input": function(evt) {
					var code = evt.keyCode;

					if (evt.keyCode == 13) { // Enter
						me.save();
					}
				}
			}
		});

		// If root, add Save & Cancel button
		// TODO remove these after saving & cache, to reduce number of DOM elements lying around
		this.element.appendChild(this.buttons.edit);
	}
};

_.prototype = $.extend(Object.create(Super.prototype), {
	constructor: _,
	get isRoot() {
		return !this.property;
	},

	get properties () {
		// TODO cache this
		return $$(Wysie.selectors.property, this.element).filter(function(property){
			return this.element === property.parentNode.closest(Wysie.selectors.scope);
		}, this);
	},

	get data() {
		var ret = {};

		this.properties.forEach(function(prop){
			var unit = prop._.data.unit;

			ret[unit.property] = unit.data;
		});

		return ret;
	},

	edit: function() {
		this.element.setAttribute("data-editing", "");

		if (this.isRoot) {
			this.element.removeChild(this.buttons.edit);
			this.element.appendChild(this.buttons.savecancel);
		}

		this.properties.forEach(function(prop){
			prop._.data.unit.edit();
		});

		this.collections.forEach(function (collection){
			if (collection.length === 0) {
				var item = collection.add();

				item._.data.unit.edit();
			}
		});
	},

	save: function() {
		// TODO make this a class when we handle references properly in classes so we can toggle other classes
		this.element.removeAttribute("data-editing");

		if (this.isRoot) {
			$.remove(this.buttons.savecancel);
			this.element.appendChild(this.buttons.edit);
		}

		this.properties.forEach(function(prop){
			prop._.data.unit.save();
		}, this);

		this.wysie.save();
	},

	cancel: function() {
		if (this.isRoot) {
			$.remove(this.buttons.savecancel);
			this.element.appendChild(this.buttons.edit);
		}

		this.element.removeAttribute("data-editing");

		this.properties.forEach(function(prop){
			prop._.data.unit.cancel();
		});
	},

	// Inject data in this element
	render: function(data) {
		if (!data) {
			return;
		}
		
		this.properties.forEach(function(prop){
			var property = prop._.data.unit;

			var datum = Wysie.queryJSON(data, prop.getAttribute("property"));

			if (datum) {
				property.render(datum);
			}

			property.save();
		});

		this.collections.forEach(function (collection){
			collection.render(data[collection.property]);
		});
	}
});

})();