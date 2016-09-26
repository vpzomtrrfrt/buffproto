/* Helper functions for using the protocol */

var STRING_DECODER = new (require('string_decoder').StringDecoder)('utf8');

var readUInt = function(buffer, endian, offset, length) {
	if(endian === "BE" || endian === "big") {
		return buffer.readUIntBE(offset, length);
	}
	else if(endian === "LE" || endian === "little") {
		return buffer.readUIntLE(offset, length);
	}
	else {
		throw "Unknown endianness";
	}
};

var writeUInt = function(buffer, value, endian, offset, length) {
	if(endian === "BE" || endian === "big") {
		return buffer.writeUIntBE(value, offset, length);
	}
	else if(endian === "LE" || endian === "little") {
		return buffer.writeUIntLE(value, offset, length);
	}
	else {
		throw "Unknown endianness";
	}
};

var BuffProto = function(def) {
	this.def = def;
	for(var i = 0; i < def.length; i++) {
		if(typeof def[i].type === "string") {
			def[i].type = BuffProto.types[def[i].type];
		}
	}
};
BuffProto.types = {};
BuffProto.types.string = {
	parse: function(def, buf) {
		var len = -1;
		if(def.lengthBytes > 0) {
			len = readUInt(buf, def.lengthBytesEndian || "BE", 0, def.lengthBytes);
		}
		var nul = false;
		var bytes = [];
		for(var i = def.lengthBytes || 0; i < buf.length; i++) {
			if(len != -1 && bytes.length >= len) break;
			var bite = buf[i];
			if(bite == 0) {
				nul = true;
				break;
			}
			bytes.push(bite);
		}
		return {
			length: (def.lengthBytes||0)+bytes.length+nul?1:0,
			data: STRING_DECODER.write(Buffer.from(bytes))
		};
	},
	encode: function(def, data) {
		if(def.nul) data += "\0";
		var buf = Buffer.alloc(def.lengthBytes||0+data.length);
		if(def.lengthBytes > 0) {
			writeUInt(buf, data.length, def.lengthBytesEndian || "BE", 0, def.lengthBytes);
		}
		buf.write(data, def.lengthBytes||0);
		return buf;
	}
};
BuffProto.types.uint = {
	parse: function(def, buf) {
		return {
			length: def.bytes,
			data: readUInt(buf, def.endian || "BE", 0, def.bytes)
		};
	},
	encode: function(def, data) {
		var buf = Buffer.alloc(def.bytes);
		writeUInt(buf, data, def.endian || "BE", 0, def.bytes);
		return buf;
	}
};
BuffProto.prototype.parse = function(buffer) {
	var remaining = buffer;
	var tr = {proto: this};
	for(var i = 0; i < this.def.length; i++) {
		var result = this.def[i].type.parse(this.def[i], remaining);
		if("name" in this.def[i]) {
			tr[this.def[i].name] = result.data;
		}
		remaining = remaining.slice(result.length);
	}
	return tr;
};
BuffProto.prototype.encode = function(data) {
	var buffers = [];
	for(var i = 0; i < this.def.length; i++) {
		var subdef = this.def[i];
		var value = subdef.value;
		if(subdef.name && subdef.name in data) {
			value = data[subdef.name];
		}
		var buffer = subdef.type.encode(subdef, value);
		buffers.push(buffer);
	}
	return Buffer.concat(buffers);
};

module.exports = BuffProto;
