const Message = require('../models/Message');

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    }).populate('senderId', 'name avatar').populate('receiverId', 'name avatar').sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

exports.sendMessage = async (req, res) => {
  const { receiverId, text } = req.body;
  try {
    const message = new Message({
      senderId: req.user._id,
      receiverId,
      text,
      isPrivate: true,
    });
    await message.save();
    await message.populate('senderId', 'name avatar');
    await message.populate('receiverId', 'name avatar');
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
