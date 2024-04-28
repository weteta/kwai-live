const net = require('net')
const protobufjs = require("protobufjs")
const axios = require('axios')
const crypto = require('crypto')

let kwaiSchemaPath = require.resolve('./proto/kwai.proto')

class KwaiClient {
	constructor(username, socket) {
		this.username = username
		this.timer = null
		this.kwaiSchema = null
		this.header_pack = null
		this.liveStreamId = null
		this.expTag = null
		this.user_id = null
		this.token = null
		this.final_string = ""
		this.buffered = ""
		this.firstMessage = true
		this.io = socket
		this.client = new net.Socket()
		this.host = "99.83.187.25"
		this.port = 8888
		this.start()
	}

	async start() {
		this.client.connect(this.port, this.host, () => {
			this.userSearch()
		})

		this.client.on('data', (data) => {
			const e = data.toString("hex").split('011a2b3c000000000000000000000022')[1]
			if (this.firstMessage == true && e) {
				this.final_string += e.substr(e.length -25)
				this.firstMessage = false
			}
			
			const result = data.toString("hex").slice(32)
			if (result.substr(result.length -25) == this.final_string) {
				if (this.buffered.length > 1) {
					this.buffered = this.buffered + data.toString("hex")
				} else {
					this.buffered = data.toString("hex")
				}

				const hex = this.buffered.slice(32)
				if (this.header_pack = hex.split(/011a2b3c000000000000000000[0-9a-f]{6}/)) {
					this.header_pack.forEach(item => {
						const msg = this.decodeMessage(Uint8Array.from(Buffer.from(item, 'hex')))
						this.io.emit('data', msg);
						if (msg.status == 310) {
							if (Array.isArray(msg.params.chatMessage)) {
								msg.params.chatMessage.forEach((message) => {
									console.log(message.params.name + ": " + message.message1)
								})
							}
							if (Array.isArray(msg.params.chatMessageLike)) {
								msg.params.chatMessageLike.forEach((message) => {
									console.log(message.params.name + ": liked the LIVE")
								})
							}
							if (Array.isArray(msg.params.chatMessageGift)) {
								msg.params.chatMessageGift.forEach((message) => {
									console.log(message.params.name + ": Sent a gift")
								})
							}
							if (Array.isArray(msg.params.chatMessageShare)) {
								msg.params.chatMessageShare.forEach((message) => {
									console.log(message.message1)
								})
							}
							if (Array.isArray(msg.params.chatMessageJoin)) {
								msg.params.chatMessageJoin.forEach((message) => {
									console.log(message.params.name + ": joined")
								})
							}
						}
					})
				}

				this.buffered = ""
			} else {
				this.buffered += data.toString("hex")
			}
		})

		setInterval(() => {
			this.client.write(Buffer.from("011A2B3C00000000000000000000001A" + Buffer.from(this.heartbeat(), 'utf8').toString('hex'), 'hex'))
		}, 10000)
	}

	loadKwaiSchema() {
		if (!this.kwaiSchema) {
			this.kwaiSchema = protobufjs.loadSync(kwaiSchemaPath)
		}
	}

	typeEncode(protoName, obj) {
		this.loadKwaiSchema()
		return this.kwaiSchema.lookupType(`Kwai.${protoName}`).encode(obj).finish()
	}

	decodeMessage(binary) {
		const msg = this.typeDecode('SocketMessage', binary)
		switch (msg.status) {
			case "300":
				return this.typeDecode('FirstMessage', binary)
			case "307":
				return this.typeDecode('CSWebEnterRoom', binary)
			case "310":
				return this.typeDecode('SCWebFeedPush', binary)
			default:
				return ''
		}
	}

	typeDecode(type, payload) {
		this.loadKwaiSchema()
		const msgType = this.kwaiSchema.lookupType(`Kwai.${type}`)
		const msg = msgType.decode(payload)

		var object = msgType.toObject(msg, {
			longs: String,
			enums: String,
			bytes: String
		})
		return object
	}

	startMessage() {
		const payload = {
			status: 204,
			type2: 1,
			params: {
				liveStreamId: this.liveStreamId,
				room: 2,
				deviceID: "ANDROID_8ec206c37f1c89a8",
				language: "en_US",
				version: "10.3.10.534803",
				integer1: 31.249160,
				integer2: 121.48790,
				wifi: "WIFI",
			}
		}
		return this.typeEncode('Start', payload)
	}

	heartbeat() {
		const payload = {
			status: 1,
			type2: 1,
			params: {
				timestamp: new Date().getTime(),
				liveStreamId: this.liveStreamId,
			}
		}
		return this.typeEncode('HeartbeatClient', payload)
	}

	enterRoom() {
		const payload = {
			status: 200,
			type2: 1,
			params: {
				number1: 2,
				phone: "ANDROID_8ec206c37f1c89a8",
				liveStreamId: this.liveStreamId,
				number2: 4294967295,
				locale: "en_US",
				version: "10.3.30.535003",
				ntp: "31.24916,121.48789833333333",
				wifi: "WIFI",
				number3: 1,
				expTag: this.expTag,
				attach: "unlogin",
				number4: 11,
				token2: this.token,
				plat: "KWAI",
				typePhone: "ANDROID_PHONE",
				number5: 100000,
				gift: '{"giftId":0}'
			}
		}
		return this.typeEncode('EnterRoom', payload)
	}

	async startPlay() {
		const url = "https://az2-api-akpro.kwai-pro.com/rest/o/live/v2/startPlay?"
		const query = `mod=unknown%28unknown%29&lon=0&countryInfo=USA&abi=armeabi-v7a&country_code=us&bucket=us&netScore=1&kpn=KWAI&timestamp=${new Date().getTime()}&kwai_tiny_type=2&ds=100&oc=UNKNOWN&egid=&appver=10.3.30.535003&session_id=&mcc=724&pkg=com.kwai.video&__NS_sig3=&kpf=ANDROID_PHONE&did=ANDROID_8ec206c37f1c89a8&app=1&net=WIFI&ud=0&c=GOOGLE_PLAY&time_zone=UTC%20America%2FNew_York&sys=KWAI_ANDROID_5.1.1&language=en-us&lat=0&ver=10.3`

		const data = {
			'author': this.user_id,
			'exp_tag': this.expTag,
			'liveStreamId': this.liveStreamId,
			'isRetry': 'false',
			'adExtInfo': '{"gaid":"02481f56-ceac-4a1c-9d6f-ed7fbbfbbbed","userAgent":"Dalvik\\/2.1.0 (Linux; U; Android 5.1.1; ASUS_I005DA Build\\/LMY48Z)"}',
			'client_key': '3c2cd3f3',
			'os': 'android',
		}
		const sig = this.createSignature(query, data)

		data['sig'] = sig
		const res = await axios.post(url + query, new URLSearchParams(data), {
			headers: {
				'user-agent': 'kwai-android aegon/3.12.1-2-ge5f58c20-nodiag-nolto',
				'content-type': 'application/x-www-form-urlencoded',
				'x-client-info': 'model=ASUS_I005DA;os=Android;nqe-score=8;network=WIFI;signal-strength=4;'
			}}
		)
		this.token = res.data.token
		this.client.write(Buffer.from("011A2B3C000000000000000000000060" + Buffer.from(this.startMessage(), 'utf8').toString('hex'), 'hex'))
		this.client.write(Buffer.from("011A2B3C0000000000000000000001EE" + Buffer.from(this.enterRoom(), 'utf8').toString('hex'), 'hex'))
	}

	async userSearch() {
		const url = "https://az2-api-akpro.kwai-pro.com/rest/o/user/search?"
		const query = `mod=unknown%28unknown%29&lon=0&countryInfo=USA&abi=armeabi-v7a&country_code=us&bucket=us&netScore=1&kpn=KWAI&timestamp=${new Date().getTime()}&kwai_tiny_type=2&ds=100&oc=UNKNOWN&egid=&appver=10.3.30.535003&session_id=&mcc=724&pkg=com.kwai.video&__NS_sig3=&kpf=ANDROID_PHONE&did=ANDROID_8ec206c37f1c89a8&app=1&net=WIFI&ud=0&c=GOOGLE_PLAY&time_zone=UTC%20America%2FNew_York&sys=KWAI_ANDROID_5.1.1&language=en-us&lat=0&ver=10.3`

		const data = {
			'user_name': this.username,
			'page': '1',
			'source': 'USER_INPUT',
			'searchSubQueryID': 'd1bdf8ac-b292-43bf-ac52-6b51b622843d',
			'adExtInfo': '{"gaid":"02481f56-ceac-4a1c-9d6f-ed7fbbfbbbed","userAgent":"Dalvik\\/2.1.0 (Linux; U; Android 5.1.1; ASUS_I005DA Build\\/LMY48Z)"}',
			'client_key': '3c2cd3f3',
			'os': 'android',
		}

		const sig = this.createSignature(query, data);

		data['sig'] = sig
		const res = await axios.post(url + query, new URLSearchParams(data), {
			headers: {
				'user-agent': 'kwai-android aegon/3.12.1-2-ge5f58c20-nodiag-nolto',
				'content-type': 'application/x-www-form-urlencoded',
				'x-client-info': 'model=ASUS_I005DA;os=Android;nqe-score=8;network=WIFI;signal-strength=4;'
			}}
		)
		this.liveStreamId = res.data.users[0].liveInfo.liveStreamId
		this.expTag = res.data.users[0].liveInfo.exp_tag
		this.user_id = res.data.users[0].liveInfo.user.user_id
		this.startPlay()
	}

	createSignature(queryStr, postArr) {
		let query_obj = {}
		let str_list = queryStr.split('&')
		for (const data of str_list) {
			const item = data.split('=')
			query_obj[item[0]] = item[1]
		}
		let map_object = {...query_obj, ...postArr}
		let sortedMap = Object.entries(map_object).sort((a, b) => a[0] > b[0] ? 1 : -1)
		let urlString = ""
		for (let item of sortedMap) {
			if (item[0] === 'sig' || item[0] === '__NS_sig3' || item[0] === '__NStokensig') {
				continue
			}
			let str = item[0] + '=' + decodeURIComponent(item[1])
			urlString += str
		}
		let str = urlString + "382700b563f4"
		let hash = crypto.createHash('md5')
		hash.update(str, 'utf8')
		return hash.digest('hex')
	}
}

module.exports = KwaiClient