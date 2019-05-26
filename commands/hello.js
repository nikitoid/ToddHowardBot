module.exports = {
	r: /^(привет|hello)\s(тодд|тод|todd|tod)/i,
	f: function (context, params, vk) {
		vk.api.users.get({
			user_ids: context.senderId
		})
		.then((user) => {
			return context.send(`Привет ${user[0].first_name}`);
		})
	},
	admin: 0
}